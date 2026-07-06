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
    """Embedding'i sabit 3 boyutlu vektörle taklit eder (model yüklenmez).

    Chunker'ın tokenizer erişimi de etkisizleştirilir; aksi halde
    `try_get_token_counter` gerçek modeli indirmeye çalışır.
    """
    monkeypatch.setattr(
        embedding_service, "embed_texts",
        lambda texts: [[1.0, 0.0, 0.0] for _ in texts],
    )
    monkeypatch.setattr(
        embedding_service, "embed_query", lambda text: [1.0, 0.0, 0.0]
    )
    monkeypatch.setattr(
        embedding_service, "try_get_token_counter", lambda: None
    )
    monkeypatch.setattr(
        embedding_service, "try_get_max_seq_tokens", lambda: None
    )


@pytest.fixture(autouse=True)
def _patch_ocr_availability(monkeypatch):
    """OCR motor kontrolünü stub'lar; testte gerçek motor başlatılmaz.

    (`is_available` gerçek çağrıda EasyOCR/Tesseract kurulumunu tetikleyebilir;
    uyarı mesajı kararları için sabit True yeterlidir.)
    """
    monkeypatch.setattr(
        document_processor.ocr_service, "is_available", lambda: True
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


def test_partial_extraction_sets_warning_and_stats(
    test_session, isolated_collection, tmp_path, monkeypatch
):
    """Bazı sayfalar okunamadıysa doküman `ready` olur ama uyarı + istatistik taşır."""
    from app.services.text_extractor import ExtractedPage

    monkeypatch.setattr(document_processor, "SessionLocal", test_session)
    doc_id = _seed_document(test_session, tmp_path)

    pages = [
        ExtractedPage(page_number=1, text="Birinci sayfanın normal metni burada."),
        ExtractedPage(page_number=2, text="", source="failed"),
        ExtractedPage(
            page_number=3,
            text="Üçüncü sayfa OCR ile okundu.",
            source="ocr",
            ocr_confidence=0.9,
        ),
    ]
    monkeypatch.setattr(
        document_processor, "extract_pages", lambda path, ftype: pages
    )

    document_processor.process_document(doc_id)

    db = test_session()
    try:
        document = db.get(Document, doc_id)
        assert document.status == "ready"
        assert document.warning_msg is not None
        assert "1/3" in document.warning_msg
        assert document.page_count == 3
        assert document.pages_ocr == 1
        assert document.pages_failed == 1

        # OCR sayfasından gelen chunk kaynak/güven metadata'sını taşımalı.
        ocr_chunks = db.scalars(
            select(Chunk).where(
                Chunk.document_id == doc_id, Chunk.page_number == 3
            )
        ).all()
        assert ocr_chunks
        assert all(c.source_type == "ocr" for c in ocr_chunks)
        assert all(c.ocr_confidence == 0.9 for c in ocr_chunks)
    finally:
        db.close()


def test_all_pages_failed_without_ocr_gives_scanned_error(
    test_session, isolated_collection, tmp_path, monkeypatch
):
    """Tüm sayfalar `failed` ve OCR yoksa hata mesajı taranmış PDF'i açıklamalı."""
    from app.services.text_extractor import ExtractedPage

    monkeypatch.setattr(document_processor, "SessionLocal", test_session)
    doc_id = _seed_document(test_session, tmp_path)

    pages = [
        ExtractedPage(page_number=1, text="", source="failed"),
        ExtractedPage(page_number=2, text="", source="failed"),
    ]
    monkeypatch.setattr(
        document_processor, "extract_pages", lambda path, ftype: pages
    )
    monkeypatch.setattr(
        document_processor.ocr_service, "is_available", lambda: False
    )

    document_processor.process_document(doc_id)

    db = test_session()
    try:
        document = db.get(Document, doc_id)
        assert document.status == "error"
        assert "taranmış" in document.error_msg
        assert document.pages_failed == 2
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
