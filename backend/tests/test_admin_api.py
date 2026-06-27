"""`/admin/*` endpoint'leri için HTTP + rol bazlı yetkilendirme testleri (Hafta 5).

Kapsam:
- Yetkilendirme: token yok -> 401, admin olmayan -> 403, admin -> 200.
- Kullanıcı listeleme (doküman sayısıyla).
- Kullanıcı güncelleme: rol/aktiflik, kendini kilitleme koruması, geçersiz rol,
  bulunamayan kullanıcı.
- Pasifleştirme uçtan uca: admin kullanıcıyı pasifleştirir -> kullanıcı giriş
  yapamaz (auth router'ı da dahil edilir).
- Doküman listeleme (tüm kullanıcılar) ve silme (sahip bağımsız).
- Sistem istatistikleri.

DB için bellek içi SQLite kullanılır; doküman silmenin ChromaDB/dosya yan
etkileri monkeypatch ile devre dışı bırakılır.
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
from app.routers import admin, auth
from app.services import document_service
from app.utils.security import create_access_token, hash_password


@pytest.fixture()
def client(monkeypatch):
    """`admin` + `auth` router'larını içeren izole test uygulaması.

    Seed:
    - id=1 admin (aktif)
    - id=2 user (aktif), iki dokümanı var (biri ready, biri processing)
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
        User(id=1, email="admin@x.com", hashed_password=hash_password("secret"),
             role="admin", is_active=True),
        User(id=2, email="u2@x.com", hashed_password=hash_password("secret"),
             role="user", is_active=True),
        User(id=3, email="u3@x.com", hashed_password=hash_password("secret"),
             role="user", is_active=False),
    ])
    seed.add_all([
        Document(id=10, user_id=2, filename="a.pdf", original_filename="a.pdf",
                 file_type="pdf", file_path="/uploads/a.pdf", status="ready"),
        Document(id=11, user_id=2, filename="b.txt", original_filename="b.txt",
                 file_type="txt", file_path="/uploads/b.txt", status="processing"),
    ])
    seed.commit()
    seed.close()

    def override_get_db():
        db = TestingSession()
        try:
            yield db
        finally:
            db.close()

    # Doküman silmenin dış yan etkilerini (ChromaDB, fiziksel dosya) devre dışı bırak.
    monkeypatch.setattr(
        document_service.vector_store, "delete_by_document", lambda doc_id: None
    )
    monkeypatch.setattr(
        document_service.file_service, "delete_file", lambda path: True
    )

    app = FastAPI()
    app.include_router(admin.router)
    app.include_router(auth.router)
    app.dependency_overrides[get_db] = override_get_db

    yield TestClient(app)

    app.dependency_overrides.clear()


def _auth(user_id: int, role: str) -> dict[str, str]:
    token = create_access_token(subject=user_id, role=role)
    return {"Authorization": f"Bearer {token}"}


# --- Yetkilendirme -------------------------------------------------------


def test_admin_users_without_token_returns_401(client):
    assert client.get("/admin/users").status_code == 401


def test_admin_users_as_non_admin_returns_403(client):
    res = client.get("/admin/users", headers=_auth(2, "user"))
    assert res.status_code == 403


def test_non_admin_blocked_on_all_admin_endpoints(client):
    headers = _auth(2, "user")
    assert client.get("/admin/users", headers=headers).status_code == 403
    assert client.get("/admin/documents", headers=headers).status_code == 403
    assert client.get("/admin/stats", headers=headers).status_code == 403
    assert client.patch(
        "/admin/users/3", json={"is_active": True}, headers=headers
    ).status_code == 403
    assert client.delete("/admin/documents/10", headers=headers).status_code == 403


# --- Kullanıcı listeleme -------------------------------------------------


def test_admin_lists_all_users_with_document_count(client):
    res = client.get("/admin/users", headers=_auth(1, "admin"))
    assert res.status_code == 200
    users = res.json()
    assert len(users) == 3
    by_id = {u["id"]: u for u in users}
    assert by_id[2]["document_count"] == 2
    assert by_id[1]["document_count"] == 0
    assert by_id[3]["is_active"] is False


# --- Kullanıcı güncelleme ------------------------------------------------


def test_admin_promotes_user_to_admin(client):
    res = client.patch(
        "/admin/users/2", json={"role": "admin"}, headers=_auth(1, "admin")
    )
    assert res.status_code == 200
    assert res.json()["role"] == "admin"


def test_admin_deactivates_user(client):
    res = client.patch(
        "/admin/users/2", json={"is_active": False}, headers=_auth(1, "admin")
    )
    assert res.status_code == 200
    assert res.json()["is_active"] is False


def test_admin_cannot_self_deactivate(client):
    res = client.patch(
        "/admin/users/1", json={"is_active": False}, headers=_auth(1, "admin")
    )
    assert res.status_code == 400


def test_admin_cannot_self_demote(client):
    res = client.patch(
        "/admin/users/1", json={"role": "user"}, headers=_auth(1, "admin")
    )
    assert res.status_code == 400


def test_update_invalid_role_returns_422(client):
    res = client.patch(
        "/admin/users/2", json={"role": "superuser"}, headers=_auth(1, "admin")
    )
    assert res.status_code == 422


def test_update_missing_user_returns_404(client):
    res = client.patch(
        "/admin/users/999", json={"role": "admin"}, headers=_auth(1, "admin")
    )
    assert res.status_code == 404


# --- Pasifleştirme uçtan uca (giriş engellenir) --------------------------


def test_deactivated_user_cannot_login(client):
    # Kullanıcı 2 başlangıçta giriş yapabilir.
    ok = client.post("/auth/login", json={"email": "u2@x.com", "password": "secret"})
    assert ok.status_code == 200

    # Admin kullanıcı 2'yi pasifleştirir.
    patched = client.patch(
        "/admin/users/2", json={"is_active": False}, headers=_auth(1, "admin")
    )
    assert patched.status_code == 200

    # Artık giriş yapamaz.
    blocked = client.post(
        "/auth/login", json={"email": "u2@x.com", "password": "secret"}
    )
    assert blocked.status_code == 403


# --- Doküman yönetimi ----------------------------------------------------


def test_admin_lists_all_documents_with_owner(client):
    res = client.get("/admin/documents", headers=_auth(1, "admin"))
    assert res.status_code == 200
    docs = res.json()
    assert len(docs) == 2
    assert all(d["owner_email"] == "u2@x.com" for d in docs)
    assert {d["id"] for d in docs} == {10, 11}


def test_admin_deletes_any_document(client):
    res = client.delete("/admin/documents/10", headers=_auth(1, "admin"))
    assert res.status_code == 204

    # Silindikten sonra listede görünmemeli.
    remaining = client.get("/admin/documents", headers=_auth(1, "admin")).json()
    assert {d["id"] for d in remaining} == {11}


def test_admin_delete_missing_document_returns_404(client):
    res = client.delete("/admin/documents/999", headers=_auth(1, "admin"))
    assert res.status_code == 404


# --- İstatistikler -------------------------------------------------------


def test_admin_stats(client):
    res = client.get("/admin/stats", headers=_auth(1, "admin"))
    assert res.status_code == 200
    body = res.json()
    assert body["total_users"] == 3
    assert body["active_users"] == 2
    assert body["total_documents"] == 2
    assert body["documents_by_status"] == {"ready": 1, "processing": 1}
