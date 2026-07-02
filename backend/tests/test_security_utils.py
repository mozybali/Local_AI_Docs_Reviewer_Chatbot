"""Güvenlik yardımcıları ve konfigürasyon denetimi testleri.

Kapsam:
- bcrypt şifre hash'leme: doğru/yanlış parola, 72 byte sınırında sessiz kırpma
  yerine `PasswordPolicyError`, eski (kırpılmış) hash'lerle geriye uyumluluk.
- JWT: geçersiz imza ve süresi dolmuş token reddi.
- `validate_security_settings`: varsayılan JWT secret / admin şifresi
  development'ta uyarı üretir, production'da başlatmayı engeller; güvensiz
  JWT algoritması her ortamda reddedilir; lokal olmayan LLM host'u uyarı üretir.
"""

from datetime import timedelta

import bcrypt
import pytest

from app.config import Settings, validate_security_settings
from app.utils.security import (
    JWTError,
    PasswordPolicyError,
    create_access_token,
    decode_access_token,
    hash_password,
    verify_password,
)

_STRONG_SECRET = "x" * 32
_STRONG_ADMIN_PASSWORD = "guclu-admin-sifresi-1"


def _settings(**overrides) -> Settings:
    """`.env` dosyasından bağımsız, test odaklı bir Settings örneği üretir."""
    values = {
        "JWT_SECRET_KEY": _STRONG_SECRET,
        "JWT_ALGORITHM": "HS256",
        "DEFAULT_ADMIN_PASSWORD": _STRONG_ADMIN_PASSWORD,
        "LLM_API_URL": "http://localhost:1234/v1",
        "ENVIRONMENT": "development",
    }
    values.update(overrides)
    return Settings(_env_file=None, **values)


# --- Şifre hash'leme -------------------------------------------------------


def test_hash_and_verify_roundtrip():
    hashed = hash_password("dogru-sifre-123")
    assert hashed != "dogru-sifre-123"
    assert verify_password("dogru-sifre-123", hashed) is True
    assert verify_password("yanlis-sifre", hashed) is False


def test_hash_password_rejects_over_72_bytes():
    with pytest.raises(PasswordPolicyError):
        hash_password("a" * 73)


def test_hash_password_rejects_multibyte_over_72_bytes():
    # 25 adet "ş" UTF-8'de 50 byte + 23 adet "a" = 73 byte -> reddedilmeli.
    password = "ş" * 25 + "a" * 23
    assert len(password) <= 72  # karakter sayısı sınırın altında olsa bile
    with pytest.raises(PasswordPolicyError):
        hash_password(password)


def test_hash_password_accepts_exactly_72_bytes():
    hashed = hash_password("a" * 72)
    assert verify_password("a" * 72, hashed) is True


def test_verify_password_stays_compatible_with_legacy_truncated_hashes():
    # Eski sürüm 72 byte üstünü kırparak hash'liyordu; o dönemden kalan bir
    # kullanıcı, uzun parolasıyla giriş yapmaya devam edebilmeli.
    legacy_hash = bcrypt.hashpw(("a" * 80).encode()[:72], bcrypt.gensalt())
    assert verify_password("a" * 80, legacy_hash.decode()) is True


def test_verify_password_with_invalid_hash_returns_false():
    assert verify_password("sifre", "bozuk-hash-degeri") is False


# --- JWT --------------------------------------------------------------------


def test_decode_rejects_token_signed_with_wrong_secret():
    from jose import jwt as jose_jwt

    forged = jose_jwt.encode(
        {"sub": "1", "role": "admin"}, "yanlis-secret", algorithm="HS256"
    )
    with pytest.raises(JWTError):
        decode_access_token(forged)


def test_decode_rejects_expired_token():
    token = create_access_token(
        subject=1, role="user", expires_delta=timedelta(minutes=-5)
    )
    with pytest.raises(JWTError):
        decode_access_token(token)


# --- Konfigürasyon denetimi ---------------------------------------------------


def test_secure_settings_produce_no_warnings():
    assert validate_security_settings(_settings()) == []


def test_default_jwt_secret_warns_in_development():
    warnings = validate_security_settings(
        _settings(JWT_SECRET_KEY="degistir_bu_degeri_uretimde")
    )
    assert any("JWT_SECRET_KEY" in w for w in warnings)


def test_default_jwt_secret_refuses_to_start_in_production():
    with pytest.raises(RuntimeError):
        validate_security_settings(
            _settings(
                JWT_SECRET_KEY="degistir_bu_degeri_uretimde",
                ENVIRONMENT="production",
            )
        )


def test_default_admin_password_refuses_to_start_in_production():
    with pytest.raises(RuntimeError):
        validate_security_settings(
            _settings(
                DEFAULT_ADMIN_PASSWORD="degistir_beni", ENVIRONMENT="production"
            )
        )


def test_short_jwt_secret_warns():
    warnings = validate_security_settings(_settings(JWT_SECRET_KEY="kisa"))
    assert any("JWT_SECRET_KEY" in w for w in warnings)


@pytest.mark.parametrize("algorithm", ["none", "RS256", "ES256", ""])
def test_disallowed_jwt_algorithm_is_rejected_in_any_environment(algorithm):
    with pytest.raises(RuntimeError):
        validate_security_settings(_settings(JWT_ALGORITHM=algorithm))


def test_remote_llm_host_produces_warning():
    warnings = validate_security_settings(
        _settings(LLM_API_URL="http://192.168.1.50:1234/v1")
    )
    assert any("LLM_API_URL" in w for w in warnings)


def test_local_llm_host_produces_no_warning():
    assert validate_security_settings(
        _settings(LLM_API_URL="http://127.0.0.1:1234/v1")
    ) == []
