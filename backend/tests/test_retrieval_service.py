"""Retrieval servisi birim testleri (Hafta 3).

Gerçek embedding modeli ve ChromaDB gerektirmez: `embedding_service.embed_query`
ve `vector_store.search` monkeypatch ile taklit edilir. Böylece retrieval
mantığı (kullanıcı bazlı doküman sahipliği filtresi + doküman adı çözümleme)
izole şekilde test edilir.

DB katmanı için bellek içi (in-memory) SQLite kullanılır.
"""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.models.document import Document
from app.models.user import User
from app.services import embedding_service, retrieval_service, vector_store


@pytest.fixture()
def db_session():
    """Bellek içi SQLite oturumu; tüm tablolar oluşturulur."""
    engine = create_engine("sqlite://", future=True)
    Base.metadata.create_all(engine)
    Session = sessionmaker(bind=engine, future=True)
    session = Session()

    # İki kullanıcı ve dokümanları.
    session.add_all([
        User(id=1, email="u1@x.com", hashed_password="x"),
        User(id=2, email="u2@x.com", hashed_password="x"),
        Document(id=1, user_id=1, filename="s1", original_filename="izin.pdf",
                 file_type="pdf", file_path="/tmp/s1", status="ready"),
        Document(id=2, user_id=1, filename="s2", original_filename="mesai.pdf",
                 file_type="pdf", file_path="/tmp/s2", status="ready"),
        Document(id=3, user_id=2, filename="s3", original_filename="gizli.pdf",
                 file_type="pdf", file_path="/tmp/s3", status="ready"),
    ])
    session.commit()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture(autouse=True)
def _patch_embedding(monkeypatch):
    """Embedding üretimini sabit bir vektörle taklit eder (model yüklenmez)."""
    monkeypatch.setattr(
        embedding_service, "embed_query", lambda text: [0.1, 0.2, 0.3]
    )


def test_returns_empty_for_blank_question(db_session):
    assert retrieval_service.search_chunks(db_session, 1, "   ") == []


def test_resolves_filenames_and_enriches_results(db_session, monkeypatch):
    fake_matches = [
        vector_store.VectorMatch("doc1_chunk0", "yillik izin metni", 0.91,
                                 document_id=1, chunk_index=0, page_number=4),
        vector_store.VectorMatch("doc2_chunk0", "fazla mesai metni", 0.80,
                                 document_id=2, chunk_index=3, page_number=7),
    ]
    monkeypatch.setattr(
        vector_store, "search", lambda **kwargs: fake_matches
    )

    results = retrieval_service.search_chunks(db_session, 1, "izin?")
    assert [r.document for r in results] == ["izin.pdf", "mesai.pdf"]
    assert results[0].score == 0.91
    assert results[0].page == 4
    assert results[0].chunk_index == 0
    assert results[1].document_id == 2


def test_low_score_matches_are_filtered_out(db_session, monkeypatch):
    # Eşik altındaki (alakasız) eşleşmeler bağlama alınmamalı. Eşik 0.5 iken
    # 0.80 kalır, 0.30 elenir.
    monkeypatch.setattr(retrieval_service.settings, "RETRIEVAL_MIN_SCORE", 0.5)
    fake_matches = [
        vector_store.VectorMatch("doc1_chunk0", "alakali metin", 0.80,
                                 document_id=1, chunk_index=0, page_number=4),
        vector_store.VectorMatch("doc2_chunk0", "alakasiz metin", 0.30,
                                 document_id=2, chunk_index=3, page_number=7),
    ]
    monkeypatch.setattr(vector_store, "search", lambda **kwargs: fake_matches)

    results = retrieval_service.search_chunks(db_session, 1, "soru")
    assert [r.document_id for r in results] == [1]


def test_all_below_threshold_yields_empty(db_session, monkeypatch):
    # Negatif soru: en yakın eşleşmeler bile eşik altındaysa sonuç boş dönmeli.
    # Böylece llm_service deterministik olarak NO_ANSWER üretir (LLM çağrılmaz).
    monkeypatch.setattr(retrieval_service.settings, "RETRIEVAL_MIN_SCORE", 0.5)
    fake_matches = [
        vector_store.VectorMatch("doc1_chunk0", "alakasiz", 0.10,
                                 document_id=1, chunk_index=0, page_number=4),
        vector_store.VectorMatch("doc2_chunk0", "alakasiz", 0.05,
                                 document_id=2, chunk_index=3, page_number=7),
    ]
    monkeypatch.setattr(vector_store, "search", lambda **kwargs: fake_matches)

    assert retrieval_service.search_chunks(db_session, 1, "alakasiz soru") == []


def test_orphan_document_id_is_filtered_out(db_session, monkeypatch):
    # BACKSTOP testi: Pre-filter sayesinde Chroma normalde scope dışı bir
    # document_id döndürmez. Burada fake search filtreyi yok sayıp PG'de karşılığı
    # olmayan bir document_id (yetim vektör) döndürerek -- ör. silmede DB silinip
    # Chroma temizliği yarıda kaldığında oluşan drift -- enrichment'taki
    # `ready_docs.get() is None` yedeğinin yine de elediğini doğrular.
    fake_matches = [
        vector_store.VectorMatch("doc999_chunk0", "yetim metin", 0.95,
                                 document_id=999, chunk_index=0, page_number=1),
        vector_store.VectorMatch("doc1_chunk0", "gercek metin", 0.80,
                                 document_id=1, chunk_index=0, page_number=4),
    ]
    monkeypatch.setattr(vector_store, "search", lambda **kwargs: fake_matches)

    results = retrieval_service.search_chunks(db_session, user_id=1, question="soru")
    # Yetim (999) elendi; yalnızca PG'de karşılığı olan doc1 kaldı.
    assert [r.document_id for r in results] == [1]
    assert results[0].document == "izin.pdf"


def test_non_ready_document_vectors_are_filtered_out(db_session, monkeypatch):
    # Yeniden işlemede PG commit edildikten sonra ChromaDB silme/yazma adımı
    # patlarsa doküman "error" yapılır ama eski vektörler Chroma'da kalabilir.
    # Bu vektörler PG'de hâlâ var olan (ama "error") bir dokümana işaret eder;
    # retrieval bunları status filtresiyle elemelidir.
    doc = db_session.get(Document, 2)
    doc.status = "error"
    db_session.commit()

    fake_matches = [
        vector_store.VectorMatch("doc2_chunk0", "eski mesai metni", 0.95,
                                 document_id=2, chunk_index=0, page_number=7),
        vector_store.VectorMatch("doc1_chunk0", "gercek izin metni", 0.80,
                                 document_id=1, chunk_index=0, page_number=4),
    ]
    monkeypatch.setattr(vector_store, "search", lambda **kwargs: fake_matches)

    results = retrieval_service.search_chunks(db_session, user_id=1, question="soru")
    # "error" durumdaki doc2 elendi; yalnızca "ready" olan doc1 kaldı.
    assert [r.document_id for r in results] == [1]
    assert results[0].document == "izin.pdf"


def test_non_ready_document_ids_yield_empty(db_session, monkeypatch):
    # Kullanıcı yalnızca "ready" olmayan kendi dokümanını isterse vektör araması
    # hiç yapılmamalı ve sonuç boş olmalı (ready süzgeci scope'u da daraltır).
    doc = db_session.get(Document, 1)
    doc.status = "processing"
    db_session.commit()

    called = {"v": False}

    def fake_search(**kwargs):
        called["v"] = True
        return []

    monkeypatch.setattr(vector_store, "search", fake_search)
    results = retrieval_service.search_chunks(
        db_session, user_id=1, question="soru", document_ids=[1]
    )
    assert results == []
    assert called["v"] is False


def test_search_passes_user_id_to_vector_store(db_session, monkeypatch):
    seen = {}

    def fake_search(**kwargs):
        seen.update(kwargs)
        return []

    monkeypatch.setattr(vector_store, "search", fake_search)
    retrieval_service.search_chunks(db_session, user_id=1, question="soru")
    assert seen["user_id"] == 1


def test_non_owned_document_ids_yield_empty(db_session, monkeypatch):
    # user1, user2'nin dokümanını (id=3) istiyor -> sahibi olmadığı için boş.
    called = {"v": False}

    def fake_search(**kwargs):
        called["v"] = True
        return []

    monkeypatch.setattr(vector_store, "search", fake_search)
    results = retrieval_service.search_chunks(
        db_session, user_id=1, question="soru", document_ids=[3]
    )
    assert results == []
    # Sahip olunmayan ID istendiğinde vektör araması hiç yapılmamalı.
    assert called["v"] is False


def test_owned_subset_of_document_ids_is_used(db_session, monkeypatch):
    seen = {}

    def fake_search(**kwargs):
        seen.update(kwargs)
        return []

    monkeypatch.setattr(vector_store, "search", fake_search)
    # user1, [1 (kendi), 3 (baskasinin)] istiyor -> yalnizca [1] kullanilir.
    retrieval_service.search_chunks(
        db_session, user_id=1, question="soru", document_ids=[1, 3]
    )
    assert seen["document_ids"] == [1]


def test_none_document_ids_scope_limited_to_ready_docs(db_session, monkeypatch):
    # PRE-FILTER testi (document_ids=None / "tüm dokümanlarda ara" yolu).
    # Orijinal hatanın yaşadığı yol burasıydı; bu yüzden sonuç elemesine GÜVENMEDEN
    # Chroma'ya gönderilen scope'u argüman düzeyinde doğruluyoruz. doc2'yi "error"
    # yaparsak ready scope'tan düşmeli; doc3 zaten başka kullanıcının.
    db_session.get(Document, 2).status = "error"
    db_session.commit()

    seen = {}

    def fake_search(**kwargs):
        seen.update(kwargs)
        return []

    monkeypatch.setattr(vector_store, "search", fake_search)
    retrieval_service.search_chunks(db_session, user_id=1, question="soru")
    # user1'in tek ready dokümanı doc1; Chroma sorgusu yalnızca onunla sınırlanmalı.
    assert seen["document_ids"] == [1]
