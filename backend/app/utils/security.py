"""Güvenlik yardımcıları: şifre hash'leme (bcrypt) ve JWT üretimi/doğrulama.

Şifreler hiçbir zaman düz metin saklanmaz; bcrypt ile hash'lenir.
Kimlik doğrulama stateless JWT yaklaşımıyla yapılır.
"""

from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
from jose import JWTError, jwt

from app.config import settings

# bcrypt yalnızca ilk 72 byte'ı kullanır. Sessiz kırpma (truncate), kullanıcının
# sandığından daha kısa bir parolayla hash üretilmesine yol açar; bu yüzden yeni
# parolalar hash'lenirken 72 byte üstü REDDEDİLİR. Doğrulama tarafında ise eski
# (kırpılarak hash'lenmiş) kayıtlarla uyumluluk için kırpma korunur.
_BCRYPT_MAX_BYTES = 72

PASSWORD_TOO_LONG_MESSAGE = (
    f"Şifre en fazla {_BCRYPT_MAX_BYTES} byte olabilir "
    "(Türkçe karakterler birden fazla byte sayılır)."
)


class PasswordPolicyError(ValueError):
    """Parola politikasına aykırı girdi (örn. bcrypt 72 byte sınırı aşımı)."""


def _to_bcrypt_bytes(password: str) -> bytes:
    """Parolayı bcrypt'in kabul ettiği en fazla 72 byte'lık gösterime çevirir."""
    return password.encode("utf-8")[:_BCRYPT_MAX_BYTES]


def hash_password(password: str) -> str:
    """Düz metin şifreyi bcrypt ile hash'ler.

    72 byte'tan uzun parolalar sessizce kırpılmaz; `PasswordPolicyError`
    fırlatılır (router katmanı bunu 422'ye çevirir/şemada engeller).
    """
    if len(password.encode("utf-8")) > _BCRYPT_MAX_BYTES:
        raise PasswordPolicyError(PASSWORD_TOO_LONG_MESSAGE)
    hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
    return hashed.decode("utf-8")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Düz metin şifrenin hash ile eşleşip eşleşmediğini doğrular."""
    try:
        return bcrypt.checkpw(
            _to_bcrypt_bytes(plain_password),
            hashed_password.encode("utf-8"),
        )
    except ValueError:
        # Geçersiz/bozuk hash formatı için doğrulama başarısız sayılır.
        return False


def create_access_token(
    subject: str | int,
    role: str,
    expires_delta: timedelta | None = None,
    extra_claims: dict[str, Any] | None = None,
) -> str:
    """İmzalı bir JWT access token üretir.

    `sub` claim'i kullanıcı id'sini, `role` claim'i ise yetki rolünü taşır.
    """
    now = datetime.now(timezone.utc)
    expire = now + (
        expires_delta
        or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    to_encode: dict[str, Any] = {
        "sub": str(subject),
        "role": role,
        "iat": now,
        "exp": expire,
    }
    if extra_claims:
        to_encode.update(extra_claims)
    return jwt.encode(
        to_encode, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM
    )


def decode_access_token(token: str) -> dict[str, Any]:
    """JWT'yi doğrular ve payload'ı döner.

    Geçersiz veya süresi dolmuş token için `jose.JWTError` fırlatır.
    """
    return jwt.decode(
        token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM]
    )


__all__ = [
    "hash_password",
    "verify_password",
    "create_access_token",
    "decode_access_token",
    "JWTError",
    "PasswordPolicyError",
    "PASSWORD_TOO_LONG_MESSAGE",
]
