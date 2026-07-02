"""`/chat/ask` endpoint'i için HTTP + kimlik doğrulama testleri (Hafta 4).

`test_llm_service.py` (servis mantığı) ve `test_search_api.py` (retrieval HTTP)
testlerini tamamlar: burada RAG endpoint'inin uçtan uca davranışı test edilir
(token yok -> 401, pasif kullanıcı -> 403, başarılı cevap + kaynaklar, boş
retrieval -> standart yanıt, alt servis hataları -> 503).

Embedding modeli, ChromaDB ve gerçek LLM gerektirmez:
`retrieval_service.search_chunks` ve `llm_service.generate_answer` monkeypatch
ile taklit edilir. DB için bellek içi SQLite kullanılır.
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
from app.routers import chat
from app.services import llm_service, retrieval_service
from app.services.embedding_service import EmbeddingError
from app.services.llm_service import NO_ANSWER, LLMServiceError
from app.services.retrieval_service import RetrievedChunk
from app.utils.security import create_access_token, hash_password


@pytest.fixture()
def client():
    """Yalnızca `chat` router'ını içeren izole test uygulaması.

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
    app.include_router(chat.router)
    app.dependency_overrides[get_db] = override_get_db

    yield TestClient(app)

    app.dependency_overrides.clear()


def _auth(user_id: int) -> dict[str, str]:
    token = create_access_token(subject=user_id, role="user")
    return {"Authorization": f"Bearer {token}"}


def _chunk():
    return RetrievedChunk(
        text="Yıllık izin en az 5 iş günü önce talep edilir.",
        score=0.91, document_id=1, document="personel_yonetmeligi.pdf",
        page=4, chunk_index=12,
    )


# --- Kimlik doğrulama ----------------------------------------------------


def test_ask_without_token_returns_401(client):
    res = client.post("/chat/ask", json={"question": "yıllık izin"})
    assert res.status_code == 401


def test_ask_with_invalid_token_returns_401(client):
    res = client.post(
        "/chat/ask",
        json={"question": "yıllık izin"},
        headers={"Authorization": "Bearer not-a-real-token"},
    )
    assert res.status_code == 401


def test_ask_passive_user_returns_403(client):
    res = client.post("/chat/ask", json={"question": "soru"}, headers=_auth(2))
    assert res.status_code == 403


def test_ask_empty_question_returns_422(client):
    res = client.post("/chat/ask", json={"question": ""}, headers=_auth(1))
    assert res.status_code == 422


# --- Başarılı RAG akışı --------------------------------------------------


def test_ask_returns_answer_and_sources(client, monkeypatch):
    def fake_search(**kwargs):
        assert kwargs["user_id"] == 1  # auth'tan gelen kullanıcı geçiyor
        return [_chunk()]

    monkeypatch.setattr(retrieval_service, "search_chunks", fake_search)
    monkeypatch.setattr(
        llm_service, "generate_answer",
        lambda question, chunks: "Yıllık izin en az 5 iş günü önce yapılmalıdır.",
    )

    res = client.post(
        "/chat/ask",
        json={"question": "Yıllık izin kaç gün önce?", "document_ids": [1]},
        headers=_auth(1),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["answer"].startswith("Yıllık izin")
    assert len(body["sources"]) == 1
    source = body["sources"][0]
    assert source["document"] == "personel_yonetmeligi.pdf"
    assert source["page"] == 4
    assert source["chunk_index"] == 12
    assert source["score"] == 0.91


def test_ask_passes_question_and_chunks_to_llm(client, monkeypatch):
    seen = {}

    monkeypatch.setattr(
        retrieval_service, "search_chunks", lambda **kwargs: [_chunk()]
    )

    def fake_generate(question, chunks):
        seen["question"] = question
        seen["chunks"] = chunks
        return "cevap"

    monkeypatch.setattr(llm_service, "generate_answer", fake_generate)

    client.post("/chat/ask", json={"question": "izin?"}, headers=_auth(1))
    assert seen["question"] == "izin?"
    assert len(seen["chunks"]) == 1


# --- Bağlam bulunamadığında ---------------------------------------------


def test_ask_without_context_returns_standard_answer(client, monkeypatch):
    # Retrieval boş dönerse gerçek llm_service çağrılır ve bağlam boş olduğu için
    # LLM'e gitmeden NO_ANSWER döner (monkeypatch yok: gerçek kısa devre test edilir).
    monkeypatch.setattr(retrieval_service, "search_chunks", lambda **kwargs: [])

    res = client.post(
        "/chat/ask", json={"question": "alakasız soru"}, headers=_auth(1)
    )
    assert res.status_code == 200
    body = res.json()
    assert body["answer"] == NO_ANSWER
    assert body["sources"] == []


# --- Alt servis hataları -------------------------------------------------


def test_ask_llm_down_returns_503(client, monkeypatch):
    monkeypatch.setattr(
        retrieval_service, "search_chunks", lambda **kwargs: [_chunk()]
    )

    def boom(question, chunks):
        raise LLMServiceError(
            "Lokal AI modeli çalışmıyor. LM Studio local server'ını başlatın."
        )

    monkeypatch.setattr(llm_service, "generate_answer", boom)

    res = client.post("/chat/ask", json={"question": "soru"}, headers=_auth(1))
    assert res.status_code == 503
    assert "LM Studio" in res.json()["detail"]


def test_ask_embedding_error_returns_503(client, monkeypatch):
    def boom(**kwargs):
        raise EmbeddingError("model yok")

    monkeypatch.setattr(retrieval_service, "search_chunks", boom)
    res = client.post("/chat/ask", json={"question": "soru"}, headers=_auth(1))
    assert res.status_code == 503


# --- Çapraz kullanıcı izolasyonu ------------------------------------------


def test_ask_ignores_other_users_document_ids(client, monkeypatch):
    # Kullanıcı 1, kullanıcı 2'nin dokümanını (id=30) `document_ids` ile istese
    # bile sahiplik süzgeci boş kapsam üretir: vektör araması ve LLM çağrısı
    # HİÇ yapılmaz; standart "bulunamadı" cevabı ve boş kaynak listesi döner.
    monkeypatch.setattr(
        retrieval_service.embedding_service, "embed_query", lambda q: [0.1, 0.2]
    )
    called = {"vector_search": False, "llm": False}

    def fake_vector_search(**kwargs):
        called["vector_search"] = True
        return []

    def fake_http_post(path, payload):
        called["llm"] = True
        raise AssertionError("LLM çağrılmamalıydı")

    monkeypatch.setattr(retrieval_service.vector_store, "search", fake_vector_search)
    monkeypatch.setattr(llm_service, "_http_post", fake_http_post)

    res = client.post(
        "/chat/ask",
        json={"question": "gizli dokümanda ne yazıyor?", "document_ids": [30]},
        headers=_auth(1),
    )
    assert res.status_code == 200
    body = res.json()
    assert body["answer"] == NO_ANSWER
    assert body["sources"] == []
    assert called["vector_search"] is False
    assert called["llm"] is False
