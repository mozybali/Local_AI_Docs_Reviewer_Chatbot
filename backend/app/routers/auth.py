"""Kimlik doğrulama endpoint'leri: kayıt, giriş ve mevcut kullanıcı.

`/auth/register` ve `/auth/login` herkese açıktır; `/auth/me` geçerli bir
JWT gerektirir. İstek/yanıt şemaları (Pydantic) bu modül içinde tanımlıdır.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services import auth_service
from app.utils.dependencies import get_current_user
from app.utils.security import create_access_token

router = APIRouter(prefix="/auth", tags=["auth"])


# --- Şemalar -------------------------------------------------------------


class UserCreate(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)


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
def register(payload: UserCreate, db: Session = Depends(get_db)) -> User:
    """Yeni kullanıcı kaydı oluşturur. Varsayılan rol `user`'dır."""
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
def login(payload: LoginRequest, db: Session = Depends(get_db)) -> TokenResponse:
    """E-posta/şifre doğrular ve imzalı bir JWT access token döner."""
    user = auth_service.authenticate_user(db, payload.email, payload.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="E-posta veya şifre hatalı. Böyle bir kullanıcı bulunamadı.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    if not user.is_active:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Hesabınız pasifleştirilmiş. Lütfen yönetici ile iletişime geçin.",
        )
    access_token = create_access_token(subject=user.id, role=user.role)
    return TokenResponse(access_token=access_token)


@router.get("/me", response_model=UserRead)
def read_me(current_user: User = Depends(get_current_user)) -> User:
    """JWT ile kimliği doğrulanmış mevcut kullanıcının bilgisini döner."""
    return current_user
