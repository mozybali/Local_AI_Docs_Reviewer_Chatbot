"""FastAPI dependency'leri.

Yetki kontrolü tek bir merkezde toplanır. `get_current_user`, korumalı tüm
endpoint'lerde `Authorization: Bearer <token>` başlığını doğrular ve isteği
yapan kullanıcıyı döner. `require_admin` (Hafta 5) bunun üzerine `admin` rol
kontrolü ekler; `/admin/*` endpoint'leri yalnızca admin ile erişilebilir.
"""

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.utils.security import JWTError, decode_access_token

# auto_error=False: başlık yoksa kendimiz 401 döneriz (varsayılan 403 yerine).
bearer_scheme = HTTPBearer(auto_error=False)

_CREDENTIALS_EXCEPTION = HTTPException(
    status_code=status.HTTP_401_UNAUTHORIZED,
    detail="Bu işlem için giriş yapmanız gerekiyor.",
    headers={"WWW-Authenticate": "Bearer"},
)


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    """JWT'yi doğrular ve geçerli kullanıcıyı veritabanından döner.

    - Token yoksa veya geçersiz/expired ise `401` döner.
    - Kullanıcı pasifleştirilmişse `403` döner.
    """
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise _CREDENTIALS_EXCEPTION

    try:
        payload = decode_access_token(credentials.credentials)
    except JWTError:
        raise _CREDENTIALS_EXCEPTION

    subject = payload.get("sub")
    if subject is None:
        raise _CREDENTIALS_EXCEPTION

    try:
        user_id = int(subject)
    except (TypeError, ValueError):
        raise _CREDENTIALS_EXCEPTION

    user = db.get(User, user_id)
    if user is None:
        raise _CREDENTIALS_EXCEPTION

    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hesabınız pasifleştirilmiş. Lütfen yönetici ile iletişime geçin.",
        )

    return user


def require_admin(current_user: User = Depends(get_current_user)) -> User:
    """Yalnızca `admin` rolündeki kullanıcılara izin verir.

    `get_current_user` üzerine kurulur (token doğrulama + aktiflik kontrolü); rol
    `admin` değilse `403` döner. Bu sayede `/admin/*` endpoint'lerinde yetki
    kontrolü tek bir merkezde toplanır.
    """
    if current_user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Bu işlem için yetkiniz yok.",
        )
    return current_user
