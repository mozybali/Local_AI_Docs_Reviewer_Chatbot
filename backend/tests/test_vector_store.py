"""ChromaDB vektör deposu birim/entegrasyon testleri (Hafta 3).

Gerçek embedding modeli gerektirmez: vektörler elle (3 boyutlu) verilir.
Her test, gerçek `chroma_db/` dizinine dokunmamak için geçici bir persist
dizini ve ayrı bir koleksiyon kullanır.

Kapsanan kabul kriterleri:
- Bir kullanıcının araması asla başka kullanıcının chunk'ını döndürmez.
- Sonuçlarda skor, sayfa ve chunk index bulunur.
- `document_ids` filtresi aramayı sınırlar.
- Doküman silindiğinde ilgili vektörler de silinir (aramada çıkmaz).
"""

import tempfile

import pytest

from app.config import settings
from app.services import vector_store as vs


@pytest.fixture()
def isolated_collection():
    """Testi geçici bir persist dizini + koleksiyona izole eder."""
    original_dir = settings.CHROMA_PERSIST_DIR
    original_name = settings.CHROMA_COLLECTION_NAME
    tmp = tempfile.mkdtemp(prefix="chroma_test_")

    settings.CHROMA_PERSIST_DIR = tmp
    settings.CHROMA_COLLECTION_NAME = "test_collection"
    vs._get_collection.cache_clear()  # eski singleton'ı bırak

    try:
        yield
    finally:
        vs._get_collection.cache_clear()
        settings.CHROMA_PERSIST_DIR = original_dir
        settings.CHROMA_COLLECTION_NAME = original_name


def _seed():
    """İki kullanıcıya ait örnek vektörleri ekler."""
    records = [
        vs.VectorRecord("doc1_chunk0", [1.0, 0.0, 0.0], "user1 yillik izin",
                        user_id=1, document_id=1, chunk_index=0, page_number=4),
        vs.VectorRecord("doc1_chunk1", [0.9, 0.1, 0.0], "user1 fazla mesai",
                        user_id=1, document_id=1, chunk_index=1, page_number=7),
        vs.VectorRecord("doc2_chunk0", [0.0, 1.0, 0.0], "user1 baska belge",
                        user_id=1, document_id=2, chunk_index=0, page_number=1),
        vs.VectorRecord("doc3_chunk0", [1.0, 0.0, 0.0], "user2 gizli belge",
                        user_id=2, document_id=3, chunk_index=0, page_number=2),
    ]
    vs.add_vectors(records)


def test_user_isolation_and_ranking(isolated_collection):
    _seed()
    results = vs.search([1.0, 0.0, 0.0], user_id=1, top_k=5)
    ids = [m.vector_id for m in results]

    # user2'nin vektoru asla donmemeli.
    assert "doc3_chunk0" not in ids
    assert all(m.document_id in (1, 2) for m in results)
    # En benzer sonuc ilk sirada.
    assert results[0].vector_id == "doc1_chunk0"


def test_score_and_metadata(isolated_collection):
    _seed()
    top = vs.search([1.0, 0.0, 0.0], user_id=1, top_k=1)[0]
    assert top.score == pytest.approx(1.0, abs=1e-3)
    assert top.page_number == 4
    assert top.chunk_index == 0


def test_second_user_sees_only_own(isolated_collection):
    _seed()
    results = vs.search([1.0, 0.0, 0.0], user_id=2, top_k=5)
    assert [m.vector_id for m in results] == ["doc3_chunk0"]


def test_document_ids_filter(isolated_collection):
    _seed()
    results = vs.search([1.0, 0.0, 0.0], user_id=1, top_k=5, document_ids=[2])
    assert [m.vector_id for m in results] == ["doc2_chunk0"]


def test_delete_by_document_removes_from_search(isolated_collection):
    _seed()
    assert vs.count_by_document(1) == 2
    vs.delete_by_document(1)
    assert vs.count_by_document(1) == 0

    ids = [m.vector_id for m in vs.search([1.0, 0.0, 0.0], user_id=1, top_k=5)]
    assert "doc1_chunk0" not in ids and "doc1_chunk1" not in ids


def test_upsert_is_idempotent(isolated_collection):
    _seed()
    again = vs.VectorRecord("doc2_chunk0", [0.0, 1.0, 0.0], "guncellenmis",
                            user_id=1, document_id=2, chunk_index=0, page_number=1)
    vs.add_vectors([again])
    vs.add_vectors([again])
    assert vs.count_by_document(2) == 1


def test_page_none_roundtrips(isolated_collection):
    """page_number=None ChromaDB'de -1 olarak saklanır, sonuçta yine None döner."""
    vs.add_vectors([
        vs.VectorRecord("docX_chunk0", [0.0, 0.0, 1.0], "sayfasiz",
                        user_id=9, document_id=99, chunk_index=0, page_number=None),
    ])
    top = vs.search([0.0, 0.0, 1.0], user_id=9, top_k=1)[0]
    assert top.page_number is None


def test_add_vectors_batches_large_record_sets(isolated_collection, monkeypatch):
    """Kayıt sayısı dilim boyutunu aşınca upsert parçalanır ama hepsi yazılır.

    ChromaDB tek çağrıda ~5461 kayıt kabul eder; `add_vectors` bu sınırı
    aşmamak için `_UPSERT_BATCH_SIZE` dilimleriyle yazar. Test, dilim boyutunu
    küçülterek çok dilimli yolu gerçek koleksiyon üzerinde doğrular.
    """
    monkeypatch.setattr(vs, "_UPSERT_BATCH_SIZE", 2)
    records = [
        vs.VectorRecord(f"docB_chunk{i}", [float(i), 1.0, 0.0], f"parca {i}",
                        user_id=7, document_id=70, chunk_index=i, page_number=1)
        for i in range(5)
    ]
    vs.add_vectors(records)

    assert vs.count_by_document(70) == 5
    results = vs.search([0.0, 1.0, 0.0], user_id=7, top_k=10)
    assert {m.vector_id for m in results} == {f"docB_chunk{i}" for i in range(5)}


def test_build_where_single_and_combined():
    assert vs._build_where(5, None) == {"user_id": 5}
    combined = vs._build_where(5, [1, 2])
    assert combined == {
        "$and": [{"user_id": 5}, {"document_id": {"$in": [1, 2]}}]
    }
