"""`/search` endpoint'i için HTTP + kimlik doğrulama (auth) testleri (Hafta 3).

Servis seviyesindeki `test_retrieval_service.py`'yi tamamlar: burada gerçek
FastAPI yönlendirmesi + `get_current_user` bağımlılığı üzerinden HTTP davranışı
test edilir (token yok -> 401, geçersiz token -> 401, pasif kullanıcı -> 403,
geçerli istek -> 200, alt servis hataları -> 503).

Embedding modeli ve ChromaDB gerektirmez: `retrieval_service.search_chunks`
monkeypatch ile taklit edilir. DB için bellek içi SQLite kullanılır ve `get_db`
dependency'si override edilir.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.models.document import Document
from app.models.user import User
from app.routers import search
from app.services import retrieval_service
from app.services.embedding_service import EmbeddingError
from app.services.retrieval_service import RetrievedChunk
from app.services.vector_store import VectorStoreError
from app.utils.security import create_access_token, hash_password


@pytest.fixture()
def client():
    """Yalnızca `search` router'ını içeren izole bir test uygulaması.

    İki kullanıcı seed edilir: id=1 aktif, id=2 pasif. Kullanıcı 2'nin `ready`
    bir dokümanı (id=30) vardır (çapraz kullanıcı izolasyon testleri için).
    """
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, future=True)

    seed = TestingSession()
    seed.add_all([
        User(id=1, email="u1@x.com", hashed_password=hash_password("x"),
             role="user", is_active=True),
        User(id=2, email="u2@x.com", hashed_password=hash_password("x"),
             role="user", is_active=False),
        Document(id=30, user_id=2, filename="s30", original_filename="gizli.pdf",
                 file_type="pdf", file_path="/uploads/s30.pdf", status="ready"),
    ])
    seed.commit()
    seed.close()

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    app = FastAPI()
    app.include_router(search.router)
    app.dependency_overrides[get_db] = override_get_db

    yield TestClient(app)

    app.dependency_overrides.clear()


def _auth(user_id: int) -> dict[str, str]:
    token = create_access_token(subject=user_id, role="user")
    return {"Authorization": f"Bearer {token}"}


def test_search_without_token_returns_401(client):
    res = client.post("/search", json={"question": "yıllık izin"})
    assert res.status_code == 401


def test_search_with_invalid_token_returns_401(client):
    res = client.post(
        "/search",
        json={"question": "yıllık izin"},
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert res.status_code == 401


def test_search_passive_user_returns_403(client):
    res = client.post("/search", json={"question": "soru"}, headers=_auth(2))
    assert res.status_code == 403


def test_search_empty_question_returns_422(client):
    # SearchRequest.question min_length=1 -> boş soru doğrulamada reddedilir.
    res = client.post("/search", json={"question": ""}, headers=_auth(1))
    assert res.status_code == 422


def test_search_returns_results_for_authenticated_user(client, monkeypatch):
    def fake_search(**kwargs):
        assert kwargs["user_id"] == 1  # auth'tan gelen kullanıcı geçiyor
        return [
            RetrievedChunk(
                text="Yıllık izin en az 5 iş günü önce talep edilir.",
                score=0.91,
                document_id=1,
                document="personel_yonetmeligi.pdf",
                page=4,
                chunk_index=12,
            )
        ]

    monkeypatch.setattr(retrieval_service, "search_chunks", fake_search)

    res = client.post(
        "/search",
        json={"question": "Yıllık izin kaç gün önce?", "top_k": 5},
        headers=_auth(1),
    )
    assert res.status_code == 200
    body = res.json()
    assert len(body["results"]) == 1
    item = body["results"][0]
    assert item["document"] == "personel_yonetmeligi.pdf"
    assert item["page"] == 4
    assert item["score"] == 0.91
    assert item["chunk_index"] == 12


def test_search_embedding_error_returns_503(client, monkeypatch):
    def boom(**kwargs):
        raise EmbeddingError("model yok")

    monkeypatch.setattr(retrieval_service, "search_chunks", boom)
    res = client.post("/search", json={"question": "soru"}, headers=_auth(1))
    assert res.status_code == 503


def test_search_vector_store_error_returns_503(client, monkeypatch):
    def boom(**kwargs):
        raise VectorStoreError("chroma yok")

    monkeypatch.setattr(retrieval_service, "search_chunks", boom)
    res = client.post("/search", json={"question": "soru"}, headers=_auth(1))
    assert res.status_code == 503


def test_search_ignores_other_users_document_ids(client, monkeypatch):
    # Kullanıcı 1, kullanıcı 2'nin dokümanını (id=30) `document_ids` ile istese
    # bile sahiplik süzgeci boş kapsam üretir: vektör araması HİÇ yapılmaz ve
    # sonuç boş döner (gerçek `search_chunks` çalışır; alt katman taklit edilir).
    monkeypatch.setattr(
        retrieval_service.embedding_service, "embed_query", lambda q: [0.1, 0.2]
    )
    called = {"vector_search": False}

    def fake_vector_search(**kwargs):
        called["vector_search"] = True
        return []

    monkeypatch.setattr(retrieval_service.vector_store, "search", fake_vector_search)

    res = client.post(
        "/search",
        json={"question": "gizli dokümanda ne yazıyor?", "document_ids": [30]},
        headers=_auth(1),
    )
    assert res.status_code == 200
    assert res.json()["results"] == []
    assert called["vector_search"] is False
