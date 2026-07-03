"""Kimlik doğrulama endpoint'leri: kayıt, giriş ve mevcut kullanıcı.

`/auth/register` ve `/auth/login` herkese açıktır; `/auth/me` geçerli bir
JWT gerektirir. İstek/yanıt şemaları (Pydantic) bu modül içinde tanımlıdır.
"""

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services import auth_service
from app.utils.dependencies import get_current_user
from app.utils.rate_limit import rate_limiter
from app.utils.security import PASSWORD_TOO_LONG_MESSAGE, create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])

# Kimlik bilgisi hatasında e-posta varlığını sızdırmayan genel mesaj
# (README "Kullanıcıya Gösterilecek Hata Mesajları" tablosuyla uyumlu).
_INVALID_CREDENTIALS_MESSAGE = "E-posta veya şifre hatalı."

_RATE_LIMIT_MESSAGE = (
    "Çok fazla deneme yapıldı. Lütfen bir süre sonra tekrar deneyin."
)

# bcrypt yalnızca 72 byte işler; sessiz kırpma yerine şemada reddedilir.
_BCRYPT_MAX_PASSWORD_BYTES = 72


def _client_ip(request: Request) -> str:
    """Rate limit anahtarı için istemci IP'sini döner."""
    return request.client.host if request.client else "unknown"


# --- Şemalar -------------------------------------------------------------


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def password_within_bcrypt_limit(cls, value: str) -> str:
        """72 byte üstü parolayı reddeder (bcrypt sessiz kırpma önlemi)."""
        if len(value.encode("utf-8")) > _BCRYPT_MAX_PASSWORD_BYTES:
            raise ValueError(PASSWORD_TOO_LONG_MESSAGE)
        return value


class UserRead(BaseModel):
    id: int
    email: EmailStr
    role: str
    is_active: bool

    model_config = {"from_attributes": True}


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# --- Endpoint'ler --------------------------------------------------------


@router.post(
    "/register",
    response_model=UserRead,
    status_code=status.HTTP_201_CREATED,
)
def register(
    payload: UserCreate, request: Request, db: Session = Depends(get_db)
) -> User:
    """Yeni kullanıcı kaydı oluşturur. Varsayılan rol `user`'dır."""
    # Kontrol + kayıt tek adımda (atomik): eş zamanlı isteklerle limit aşılamaz.
    limit_key = f"register:{_client_ip(request)}"
    if not rate_limiter.hit(
        limit_key,
        settings.REGISTER_RATE_LIMIT_ATTEMPTS,
        settings.REGISTER_RATE_LIMIT_WINDOW_SECONDS,
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=_RATE_LIMIT_MESSAGE,
        )

    if auth_service.get_user_by_email(db, payload.email) is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Bu e-posta adresi zaten kayıtlı.",
        )
    user = auth_service.create_user(
        db, email=payload.email, password=payload.password, role="user"
    )
    return user


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest, request: Request, db: Session = Depends(get_db)
) -> TokenResponse:
    """E-posta/şifre doğrular ve imzalı bir JWT access token döner.

    Brute-force önlemi: aynı (IP, e-posta) ikilisi için pencere içindeki
    başarısız deneme sayısı sınırı aşarsa parola hiç kontrol edilmeden `429`
    döner. Başarılı giriş sayacı sıfırlar.
    """
    limit_key = f"login:{_client_ip(request)}:{payload.email.strip().lower()}"
    if not rate_limiter.is_allowed(
        limit_key,
        settings.LOGIN_RATE_LIMIT_ATTEMPTS,
        settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS,
    ):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=_RATE_LIMIT_MESSAGE,
        )

    user = auth_service.authenticate_user(db, payload.email, payload.password)
    if user is None:
        # Kullanıcı yok ile şifre hatalı aynı (genel) mesajı döner; e-posta
        # varlığı sızdırılmaz. Yalnızca başarısız denemeler limite sayılır.
        rate_limiter.record(limit_key, settings.LOGIN_RATE_LIMIT_WINDOW_SECONDS)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=_INVALID_CREDENTIALS_MESSAGE,
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hesabınız pasifleştirilmiş. Lütfen yönetici ile iletişime geçin.",
        )
    rate_limiter.reset(limit_key)
    access_token = create_access_token(subject=user.id, role=user.role)
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=UserRead)
def read_me(current_user: User = Depends(get_current_user)) -> User:
    """JWT ile kimliği doğrulanmış mevcut kullanıcının bilgisini döner."""
    return current_user
