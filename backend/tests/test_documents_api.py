"""`/documents` endpoint'leri için HTTP + çok kullanıcılı izolasyon testleri (Hafta 7).

README "7. Hafta — Test" kabul kriteri: *"Kimlik doğrulama ve yetkilendirme
testleri yapılır (token yok -> 401, başka kullanıcı dokümanı -> 403/404 ...)"*.

Bu dosya doküman uçlarındaki sahiplik kontrolünü doğrular:
- Token yok -> 401 (liste, durum, silme).
- Kullanıcı yalnızca kendi dokümanlarını listeler (izolasyon).
- Başka kullanıcının dokümanına erişim/silme -> 404 (varlığı sızdırmamak için
  403 yerine 404; bkz. documents router `_get_owned_document`).
- Sahip kendi dokümanının durumunu görebilir ve silebilir.
- Pasif kullanıcı -> 403.

DB için bellek içi SQLite kullanılır; silmenin ChromaDB/dosya yan etkileri
monkeypatch ile devre dışı bırakılır (auth/authz davranışına odaklanmak için).
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.models.document import Document
from app.models.user import User
from app.routers import documents
from app.services import document_service
from app.utils.rate_limit import rate_limiter
from app.utils.security import create_access_token, hash_password


@pytest.fixture(autouse=True)
def _clean_rate_limiter():
    """Global limiter durumunu testler arasında sıfırlar (upload limitli)."""
    rate_limiter.clear()
    yield
    rate_limiter.clear()


@pytest.fixture()
def client(monkeypatch):
    """Yalnızca `documents` router'ını içeren izole test uygulaması.

    Seed:
    - id=1 user (aktif) -> doc 10 (ready)
    - id=2 user (aktif) -> doc 20 (ready)
    - id=3 user (pasif)
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
             role="user", is_active=True),
        User(id=3, email="u3@x.com", hashed_password=hash_password("x"),
             role="user", is_active=False),
    ])
    seed.add_all([
        Document(id=10, user_id=1, filename="u1.pdf", original_filename="u1.pdf",
                 file_type="pdf", file_path="/uploads/u1.pdf", status="ready"),
        Document(id=20, user_id=2, filename="u2.pdf", original_filename="u2.pdf",
                 file_type="pdf", file_path="/uploads/u2.pdf", status="ready"),
    ])
    seed.commit()
    seed.close()

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    # Silmenin dış yan etkilerini (ChromaDB, fiziksel dosya) devre dışı bırak.
    monkeypatch.setattr(
        document_service.vector_store, "delete_by_document", lambda doc_id: None
    )
    monkeypatch.setattr(
        document_service.file_service, "delete_file", lambda path: True
    )

    app = FastAPI()
    app.include_router(documents.router)
    app.dependency_overrides[get_db] = override_get_db

    yield TestClient(app)

    app.dependency_overrides.clear()


def _auth(user_id: int) -> dict[str, str]:
    token = create_access_token(subject=user_id, role="user")
    return {"Authorization": f"Bearer {token}"}


# --- Token yok -> 401 ----------------------------------------------------


def test_list_without_token_returns_401(client):
    assert client.get("/documents").status_code == 401


def test_status_without_token_returns_401(client):
    assert client.get("/documents/10/status").status_code == 401


def test_delete_without_token_returns_401(client):
    assert client.delete("/documents/10").status_code == 401


# --- İzolasyon: kullanıcı yalnızca kendi dokümanlarını görür -------------


def test_user_lists_only_own_documents(client):
    res = client.get("/documents", headers=_auth(1))
    assert res.status_code == 200
    docs = res.json()
    assert {d["id"] for d in docs} == {10}


# --- Başka kullanıcının dokümanı -> 404 ----------------------------------


def test_status_of_other_users_document_returns_404(client):
    # Kullanıcı 1, kullanıcı 2'nin dokümanının (20) durumunu sorgulayamaz.
    res = client.get("/documents/20/status", headers=_auth(1))
    assert res.status_code == 404


def test_delete_other_users_document_returns_404(client):
    # Kullanıcı 1, kullanıcı 2'nin dokümanını (20) silemez.
    res = client.delete("/documents/20", headers=_auth(1))
    assert res.status_code == 404

    # Doküman 20 hâlâ sahibinde durmalı (silinmemiş olmalı).
    owner_view = client.get("/documents/20/status", headers=_auth(2))
    assert owner_view.status_code == 200


# --- Sahip kendi dokümanına erişebilir / silebilir -----------------------


def test_owner_can_read_own_document_status(client):
    res = client.get("/documents/10/status", headers=_auth(1))
    assert res.status_code == 200
    assert res.json()["status"] == "ready"


def test_owner_can_delete_own_document(client):
    res = client.delete("/documents/10", headers=_auth(1))
    assert res.status_code == 204

    # Silindikten sonra sahibi için de 404 dönmeli.
    assert client.get("/documents/10/status", headers=_auth(1)).status_code == 404


def test_missing_document_returns_404(client):
    res = client.get("/documents/999/status", headers=_auth(1))
    assert res.status_code == 404


# --- Pasif kullanıcı -> 403 ----------------------------------------------


def test_passive_user_returns_403(client):
    assert client.get("/documents", headers=_auth(3)).status_code == 403


# --- Upload doğrulama (auth + dosya güvenliği) ----------------------------


def test_upload_without_token_returns_401(client):
    res = client.post(
        "/documents/upload",
        files={"file": ("a.pdf", b"%PDF-1.7 icerik", "application/pdf")},
    )
    assert res.status_code == 401


def test_upload_invalid_magic_byte_returns_415(client):
    # Uzantı .pdf ama içerik PDF imzası taşımıyor -> reddedilir.
    res = client.post(
        "/documents/upload",
        files={"file": ("sahte.pdf", b"MZ\x90\x00 exe icerigi", "application/pdf")},
        headers=_auth(1),
    )
    assert res.status_code == 415


def test_upload_empty_file_returns_400(client):
    res = client.post(
        "/documents/upload",
        files={"file": ("bos.pdf", b"", "application/pdf")},
        headers=_auth(1),
    )
    assert res.status_code == 400


def test_upload_unsupported_extension_returns_415(client):
    res = client.post(
        "/documents/upload",
        files={"file": ("zararli.exe", b"MZ\x90\x00", "application/octet-stream")},
        headers=_auth(1),
    )
    assert res.status_code == 415


def test_upload_oversized_file_returns_413(client, monkeypatch):
    # Boyut sınırı, içerik okunurken uygulanır (tamamı belleğe alınmadan).
    monkeypatch.setattr(settings, "MAX_FILE_SIZE_MB", 1)
    oversized = b"%PDF-1.7" + b"0" * (1024 * 1024 + 1)
    res = client.post(
        "/documents/upload",
        files={"file": ("buyuk.pdf", oversized, "application/pdf")},
        headers=_auth(1),
    )
    assert res.status_code == 413


def test_upload_db_failure_cleans_saved_file(tmp_path, monkeypatch):
    """DB kaydı başarısız olursa diske yazılan dosya yetim bırakılmamalı.

    Upload akışı önce dosyayı diske yazar, sonra doküman satırını commit eder.
    Commit patlarsa dosya silinmeli; aksi halde `uploads/` içinde hiçbir DB
    kaydına bağlı olmayan yetim dosyalar birikir (tutarlılık + disk tüketimi).
    """
    from app.services import file_service

    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
        future=True,
    )
    Base.metadata.create_all(engine)
    TestingSession = sessionmaker(bind=engine, future=True)

    seed = TestingSession()
    seed.add(
        User(id=1, email="u@x.com", hashed_password=hash_password("x"),
             role="user", is_active=True)
    )
    seed.commit()
    seed.close()

    # Dosyalar gerçek uploads/ yerine geçici klasöre yazılsın.
    monkeypatch.setattr(file_service, "UPLOAD_PATH", tmp_path)

    class FailingCommitSession:
        """commit() çağrısı her zaman patlayan session sarmalayıcısı."""

        def __init__(self, real):
            self._real = real

        def __getattr__(self, name):
            return getattr(self._real, name)

        def commit(self):
            raise RuntimeError("Simüle edilen DB hatası")

    def override_get_db():
        db = TestingSession()
        try:
            yield FailingCommitSession(db)
        finally:
            db.close()

    app = FastAPI()
    app.include_router(documents.router)
    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app, raise_server_exceptions=False)

    res = client.post(
        "/documents/upload",
        files={"file": ("a.pdf", b"%PDF-1.7 icerik", "application/pdf")},
        headers=_auth(1),
    )
    app.dependency_overrides.clear()

    assert res.status_code == 500
    # Diske yazılan dosya temizlenmiş olmalı (yetim dosya kalmaz).
    assert list(tmp_path.iterdir()) == []


def test_upload_rate_limit_returns_429(client, monkeypatch):
    """Kullanıcı + IP başına yükleme sıklığı sınırlıdır (aşımda 429).

    Limit, dosya doğrulamasından ÖNCE uygulanır; doğrulaması başarısız olan
    denemeler de sayılır (aksi halde saldırgan geçersiz dosyalarla sınırsız
    işleme/doğrulama maliyeti üretebilirdi).
    """
    monkeypatch.setattr(settings, "UPLOAD_RATE_LIMIT_ATTEMPTS", 2)

    for _ in range(2):
        res = client.post(
            "/documents/upload",
            files={"file": ("sahte.pdf", b"MZ\x90\x00", "application/pdf")},
            headers=_auth(1),
        )
        assert res.status_code == 415  # doğrulama reddi; deneme yine sayılır

    res = client.post(
        "/documents/upload",
        files={"file": ("sahte.pdf", b"MZ\x90\x00", "application/pdf")},
        headers=_auth(1),
    )
    assert res.status_code == 429
