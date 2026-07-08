"""`/auth/*` endpoint'leri için HTTP + güvenlik testleri.

Kapsam:
- Kayıt: başarı, mükerrer e-posta (409), şifre politikası (min uzunluk,
  bcrypt 72 byte sınırında sessiz kırpma yerine reddetme).
- Giriş: başarı, genel hata mesajı (kullanıcı var/yok bilgisi sızdırılmaz),
  pasif kullanıcı (403).
- Brute-force koruması: başarısız login denemeleri ve register istekleri
  pencere içinde sınırı aşınca 429 döner; başarılı giriş sayacı sıfırlar.
- `/auth/me`: token yok -> 401, geçerli token -> kullanıcı bilgisi.

DB için bellek içi SQLite kullanılır; rate limiter her testte temizlenir.
"""

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.config import settings
from app.database import Base, get_db
from app.models.user import User
from app.routers import auth
from app.utils.rate_limit import rate_limiter
from app.utils.security import hash_password

_PASSWORD = "guclu-sifre-123"


@pytest.fixture(autouse=True)
def _clean_rate_limiter():
    """Her test izole sayaçlarla başlasın (limiter süreç genelinde tekil)."""
    rate_limiter.clear()
    yield
    rate_limiter.clear()


@pytest.fixture()
def client():
    """Yalnızca `auth` router'ını içeren izole test uygulaması.

    Seed: id=1 aktif kullanıcı, id=2 pasif kullanıcı (ikisi de `_PASSWORD` ile).
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
        User(id=1, email="aktif@x.com", hashed_password=hash_password(_PASSWORD),
             role="user", is_active=True),
        User(id=2, email="pasif@x.com", hashed_password=hash_password(_PASSWORD),
             role="user", is_active=False),
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
    app.include_router(auth.router)
    app.dependency_overrides[get_db] = override_get_db

    yield TestClient(app)

    app.dependency_overrides.clear()


# --- Kayıt ----------------------------------------------------------------


def test_register_creates_user_with_user_role(client):
    res = client.post(
        "/auth/register",
        json={"email": "yeni@x.com", "password": _PASSWORD},
    )
    assert res.status_code == 201
    body = res.json()
    assert body["email"] == "yeni@x.com"
    assert body["role"] == "user"
    assert body["is_active"] is True
    assert "password" not in body and "hashed_password" not in body


def test_register_duplicate_email_returns_409(client):
    payload = {"email": "tekrar@x.com", "password": _PASSWORD}
    assert client.post("/auth/register", json=payload).status_code == 201
    assert client.post("/auth/register", json=payload).status_code == 409


def test_register_short_password_returns_422(client):
    res = client.post(
        "/auth/register", json={"email": "kisa@x.com", "password": "kisa123"}
    )
    assert res.status_code == 422


def test_register_over_72_byte_password_rejected_not_truncated(client):
    # bcrypt yalnızca ilk 72 byte'ı kullanır; sessiz kırpma yerine 422 dönmeli.
    long_password = "a" * 73
    res = client.post(
        "/auth/register", json={"email": "uzun@x.com", "password": long_password}
    )
    assert res.status_code == 422
    assert "72" in res.text


def test_register_race_duplicate_insert_returns_409(client, monkeypatch):
    """Varlık kontrolü ile INSERT arasındaki yarışta 500 değil 409 dönmeli.

    İki eş zamanlı istek aynı e-postayla kayıt olmaya çalışırsa ikisi de
    "e-posta yok" kontrolünü geçebilir; ikinci INSERT unique ihlaline düşer.
    Bu durum kontrolsüz IntegrityError (500) yerine 409 üretmelidir.
    """
    from app.services import auth_service

    payload = {"email": "yaris@x.com", "password": _PASSWORD}
    assert client.post("/auth/register", json=payload).status_code == 201

    # Yarışı simüle et: varlık kontrolü "kayıt yok" desin; INSERT unique
    # e-posta kısıtına takılsın.
    monkeypatch.setattr(auth_service, "get_user_by_email", lambda db, email: None)
    res = client.post("/auth/register", json=payload)
    assert res.status_code == 409


def test_authenticate_unknown_user_still_runs_password_verify(monkeypatch):
    """Kullanıcı yokken de bcrypt doğrulaması koşulmalı (timing eşitleme).

    Aksi halde "e-posta kayıtlı değil" yanıtı, "şifre yanlış" yanıtından
    belirgin şekilde hızlı döner ve yanıt süresi üzerinden e-posta varlığı
    sızdırılabilir (user enumeration).
    """
    from app.services import auth_service

    verified_hashes: list[str] = []

    def fake_verify(password: str, hashed: str) -> bool:
        verified_hashes.append(hashed)
        return False

    monkeypatch.setattr(auth_service, "get_user_by_email", lambda db, email: None)
    monkeypatch.setattr(auth_service, "verify_password", fake_verify)

    assert auth_service.authenticate_user(None, "yok@x.com", "sifre") is None
    # Kullanıcı yokken de tam olarak bir kez (dummy hash ile) doğrulama yapılır.
    assert len(verified_hashes) == 1
    assert verified_hashes[0].startswith("$2b$")


def test_register_password_at_72_byte_boundary_is_accepted(client):
    res = client.post(
        "/auth/register", json={"email": "sinir@x.com", "password": "a" * 72}
    )
    assert res.status_code == 201

    # Tam 72 byte'lık parola ile giriş de çalışmalı (kırpma yok, birebir hash).
    login = client.post(
        "/auth/login", json={"email": "sinir@x.com", "password": "a" * 72}
    )
    assert login.status_code == 200


# --- Giriş ------------------------------------------------------------------


def test_login_returns_token(client):
    res = client.post(
        "/auth/login", json={"email": "aktif@x.com", "password": _PASSWORD}
    )
    assert res.status_code == 200
    body = res.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"


def test_login_error_does_not_leak_user_existence(client):
    # Var olan kullanıcı + yanlış şifre ile hiç olmayan kullanıcı AYNI genel
    # mesajı almalı; aksi halde e-posta varlığı sızdırılır (enumeration).
    wrong_password = client.post(
        "/auth/login", json={"email": "aktif@x.com", "password": "yanlis-sifre"}
    )
    unknown_user = client.post(
        "/auth/login", json={"email": "yok@x.com", "password": "yanlis-sifre"}
    )
    assert wrong_password.status_code == 401
    assert unknown_user.status_code == 401
    assert wrong_password.json()["detail"] == unknown_user.json()["detail"]
    assert wrong_password.json()["detail"] == "E-posta veya şifre hatalı."


def test_login_passive_user_returns_403(client):
    res = client.post(
        "/auth/login", json={"email": "pasif@x.com", "password": _PASSWORD}
    )
    assert res.status_code == 403


# --- Brute-force koruması ---------------------------------------------------


def test_login_rate_limit_blocks_after_failed_attempts(client, monkeypatch):
    monkeypatch.setattr(settings, "LOGIN_RATE_LIMIT_ATTEMPTS", 3)

    for _ in range(3):
        res = client.post(
            "/auth/login", json={"email": "aktif@x.com", "password": "yanlis"}
        )
        assert res.status_code == 401

    # Limit dolduktan sonra DOĞRU şifreyle bile 429 dönmeli (parola artık
    # denenmez; brute-force penceresi kapanana kadar giriş kilitlenir).
    blocked = client.post(
        "/auth/login", json={"email": "aktif@x.com", "password": _PASSWORD}
    )
    assert blocked.status_code == 429


def test_login_rate_limit_is_per_email(client, monkeypatch):
    monkeypatch.setattr(settings, "LOGIN_RATE_LIMIT_ATTEMPTS", 2)

    for _ in range(2):
        client.post("/auth/login", json={"email": "aktif@x.com", "password": "y"})

    # Başka bir e-posta için sayaç ayrıdır; genel kilitlenme olmamalı.
    other = client.post(
        "/auth/login", json={"email": "baska@x.com", "password": "y"}
    )
    assert other.status_code == 401


def test_successful_login_resets_failure_counter(client, monkeypatch):
    monkeypatch.setattr(settings, "LOGIN_RATE_LIMIT_ATTEMPTS", 2)

    client.post("/auth/login", json={"email": "aktif@x.com", "password": "y"})
    ok = client.post(
        "/auth/login", json={"email": "aktif@x.com", "password": _PASSWORD}
    )
    assert ok.status_code == 200

    # Sayaç sıfırlandığı için tek başarısız deneme yeniden 401 (429 değil) olmalı.
    res = client.post("/auth/login", json={"email": "aktif@x.com", "password": "y"})
    assert res.status_code == 401


def test_register_rate_limit_returns_429(client, monkeypatch):
    monkeypatch.setattr(settings, "REGISTER_RATE_LIMIT_ATTEMPTS", 2)

    assert client.post(
        "/auth/register", json={"email": "r1@x.com", "password": _PASSWORD}
    ).status_code == 201
    assert client.post(
        "/auth/register", json={"email": "r2@x.com", "password": _PASSWORD}
    ).status_code == 201

    blocked = client.post(
        "/auth/register", json={"email": "r3@x.com", "password": _PASSWORD}
    )
    assert blocked.status_code == 429


# --- /auth/me ----------------------------------------------------------------


def test_me_without_token_returns_401(client):
    assert client.get("/auth/me").status_code == 401


def test_me_returns_current_user(client):
    token = client.post(
        "/auth/login", json={"email": "aktif@x.com", "password": _PASSWORD}
    ).json()["access_token"]

    res = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 200
    assert res.json()["email"] == "aktif@x.com"
