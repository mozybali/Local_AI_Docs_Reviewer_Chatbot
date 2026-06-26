"""Doküman işleme entegrasyon testleri (Hafta 3).

Uçtan uca zinciri gerçek bileşenlerle (TXT çıkarma + chunking + ChromaDB yazımı +
retrieval) doğrular; yalnızca embedding modeli, model indirmemek için sabit bir
vektörle taklit edilir.

Kapsanan davranışlar:
- TXT yükle -> process_document -> PostgreSQL'de chunk + ChromaDB'de vektör +
  search ile geri bulunabilir (upload -> process -> vector write -> search).
- ChromaDB yazımı başarısız olursa doküman ASLA "ready" olmaz; "error" kalır,
  ancak PostgreSQL chunk'ları (önce commit edildiği için) yazılmış olur.

Veri tutarlılığını görebilmek için dosya tabanlı geçici SQLite kullanılır
(birden çok oturum aynı veriyi görür) ve `document_processor.SessionLocal` test
oturumuna yönlendirilir.
"""

import tempfile

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import sessionmaker

from app.config import settings
from app.database import Base
from app.models.chunk import Chunk
from app.models.document import Document
from app.models.user import User
from app.services import (
    document_processor,
    embedding_service,
    retrieval_service,
    vector_store,
)


@pytest.fixture()
def test_session(tmp_path):
    """Dosya tabanlı geçici SQLite oturum fabrikası (tablolar oluşturulur)."""
    db_path = tmp_path / "proc_test.db"
    engine = create_engine(f"sqlite:///{db_path}", future=True)
    Base.metadata.create_all(engine)
    return sessionmaker(bind=engine, future=True)


@pytest.fixture()
def isolated_collection():
    """ChromaDB'yi geçici persist dizini + ayrı koleksiyona izole eder."""
    original_dir = settings.CHROMA_PERSIST_DIR
    original_name = settings.CHROMA_COLLECTION_NAME
    tmp = tempfile.mkdtemp(prefix="chroma_proc_test_")

    settings.CHROMA_PERSIST_DIR = tmp
    settings.CHROMA_COLLECTION_NAME = "test_proc_collection"
    vector_store._get_collection.cache_clear()

    try:
        yield
    finally:
        vector_store._get_collection.cache_clear()
        settings.CHROMA_PERSIST_DIR = original_dir
        settings.CHROMA_COLLECTION_NAME = original_name


@pytest.fixture(autouse=True)
def _patch_embeddings(monkeypatch):
    """Embedding'i sabit 3 boyutlu vektörle taklit eder (model yüklenmez)."""
    monkeypatch.setattr(
        embedding_service, "embed_texts",
        lambda texts: [[1.0, 0.0, 0.0] for _ in texts],
    )
    monkeypatch.setattr(
        embedding_service, "embed_query", lambda text: [1.0, 0.0, 0.0]
    )


def _seed_document(SessionFactory, tmp_path) -> int:
    """Bir kullanıcı + işlenmemiş bir TXT dokümanı oluşturur, id döner."""
    txt = tmp_path / "izin.txt"
    txt.write_text(
        "Yıllık izin talepleri en az 5 iş günü öncesinden yapılmalıdır. "
        "Fazla mesai ücreti dokümanda belirtilen katsayıya göre hesaplanır.",
        encoding="utf-8",
    )
    db = SessionFactory()
    try:
        db.add(User(id=1, email="u1@x.com", hashed_password="x", role="user"))
        db.add(Document(
            id=1, user_id=1, filename="stored_izin.txt",
            original_filename="izin.pdf", file_type="txt",
            file_path=str(txt), status="uploaded",
        ))
        db.commit()
        return 1
    finally:
        db.close()


def test_upload_process_vector_write_search(
    test_session, isolated_collection, tmp_path, monkeypatch
):
    monkeypatch.setattr(document_processor, "SessionLocal", test_session)
    doc_id = _seed_document(test_session, tmp_path)

    document_processor.process_document(doc_id)

    db = test_session()
    try:
        document = db.get(Document, doc_id)
        assert document.status == "ready"

        pg_chunk_count = db.scalar(
            select(func.count(Chunk.id)).where(Chunk.document_id == doc_id)
        )
        assert pg_chunk_count >= 1
        # PG ile ChromaDB sayıları tutarlı olmalı.
        assert vector_store.count_by_document(doc_id) == pg_chunk_count

        # Search zinciri: chunk'lar kullanıcı bazlı geri bulunabilir.
        results = retrieval_service.search_chunks(
            db, user_id=1, question="yıllık izin", top_k=5
        )
        assert results
        assert results[0].document == "izin.pdf"
    finally:
        db.close()


def test_chroma_failure_keeps_document_not_ready(
    test_session, isolated_collection, tmp_path, monkeypatch
):
    monkeypatch.setattr(document_processor, "SessionLocal", test_session)
    doc_id = _seed_document(test_session, tmp_path)

    # ChromaDB yazımı patlasın.
    def boom(records):
        raise vector_store.VectorStoreError("chroma yazılamadı")

    monkeypatch.setattr(vector_store, "add_vectors", boom)

    document_processor.process_document(doc_id)

    db = test_session()
    try:
        document = db.get(Document, doc_id)
        # Chroma başarısızken doküman ASLA "ready" olmamalı.
        assert document.status == "error"
        assert document.error_msg
        # PostgreSQL önce commit edildiği için chunk'lar yazılmış olmalı
        # (yeniden işleme/reconcile bunları idempotent şekilde Chroma'ya taşır).
        pg_chunk_count = db.scalar(
            select(func.count(Chunk.id)).where(Chunk.document_id == doc_id)
        )
        assert pg_chunk_count >= 1
    finally:
        db.close()
