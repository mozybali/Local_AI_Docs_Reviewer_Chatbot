"""Admin endpoint'leri (Hafta 5) — rol bazlı yetkilendirme ve yönetim paneli.

Tüm endpoint'ler `require_admin` ile korunur: yalnızca `admin` rolündeki
kullanıcılar erişebilir; token yoksa `401`, admin değilse `403` döner. Admin,
çok kullanıcılı izolasyonu (yalnızca admin endpoint'lerinde) atlayarak tüm
kullanıcıları ve tüm dokümanları yönetebilir.

Endpoint'ler:
- `GET    /admin/users`             — tüm kullanıcıları (doküman sayısıyla) listeler
- `PATCH  /admin/users/{user_id}`   — rol ve/veya aktiflik günceller
- `GET    /admin/documents`         — tüm kullanıcıların dokümanlarını listeler
- `DELETE /admin/documents/{id}`    — herhangi bir dokümanı siler
- `GET    /admin/stats`             — sistem istatistiklerini döner
"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.document import Document
from app.models.user import User
from app.services.document_service import delete_document_fully
from app.utils.dependencies import require_admin

router = APIRouter(prefix="/admin", tags=["admin"])

_VALID_ROLES = {"user", "admin"}


# --- Şemalar -------------------------------------------------------------


class AdminUserRead(BaseModel):
    id: int
    email: EmailStr
    role: str
    is_active: bool
    document_count: int


class UserUpdate(BaseModel):
    """Rol ve/veya aktiflik güncellemesi; her iki alan da opsiyoneldir."""

    role: str | None = Field(default=None)
    is_active: bool | None = Field(default=None)


class AdminDocumentRead(BaseModel):
    id: int
    filename: str  # kullanıcıya gösterilen (orijinal) dosya adı
    file_type: str
    status: str
    error_msg: str | None
    upload_date: datetime
    user_id: int
    owner_email: EmailStr


class StatsResponse(BaseModel):
    total_users: int
    active_users: int
    total_documents: int
    documents_by_status: dict[str, int]


# --- Kullanıcı yönetimi --------------------------------------------------


@router.get("/users", response_model=list[AdminUserRead])
def list_users(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminUserRead]:
    """Tüm kullanıcıları, sahip oldukları doküman sayısıyla birlikte listeler."""
    users = db.scalars(select(User).order_by(User.id)).all()
    if not users:
        return []

    # Doküman sayılarını tek sorguda topla (N+1 yerine grouped count).
    counts = dict(
        db.execute(
            select(Document.user_id, func.count(Document.id)).group_by(
                Document.user_id
            )
        ).all()
    )

    return [
        AdminUserRead(
            id=user.id,
            email=user.email,
            role=user.role,
            is_active=user.is_active,
            document_count=counts.get(user.id, 0),
        )
        for user in users
    ]


@router.patch("/users/{user_id}", response_model=AdminUserRead)
def update_user(
    user_id: int,
    payload: UserUpdate,
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> AdminUserRead:
    """Bir kullanıcının rolünü ve/veya aktiflik durumunu günceller.

    Güvenlik: Admin, kendi kendini kilitlemesini önlemek için kendi rolünü
    düşüremez veya kendini pasifleştiremez.
    """
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Kullanıcı bulunamadı.",
        )

    if payload.role is not None:
        if payload.role not in _VALID_ROLES:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Geçersiz rol. Yalnızca 'user' veya 'admin' olabilir.",
            )
        if user.id == admin.id and payload.role != "admin":
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kendi admin rolünüzü düşüremezsiniz.",
            )
        user.role = payload.role

    if payload.is_active is not None:
        if user.id == admin.id and payload.is_active is False:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Kendi hesabınızı pasifleştiremezsiniz.",
            )
        user.is_active = payload.is_active

    db.commit()
    db.refresh(user)

    doc_count = db.scalar(
        select(func.count(Document.id)).where(Document.user_id == user.id)
    )

    return AdminUserRead(
        id=user.id,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        document_count=doc_count or 0,
    )


# --- Doküman yönetimi ----------------------------------------------------


@router.get("/documents", response_model=list[AdminDocumentRead])
def list_all_documents(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> list[AdminDocumentRead]:
    """Tüm kullanıcılara ait dokümanları, sahibinin e-postasıyla listeler."""
    rows = db.execute(
        select(Document, User.email)
        .join(User, Document.user_id == User.id)
        .order_by(Document.upload_date.desc())
    ).all()

    return [
        AdminDocumentRead(
            id=doc.id,
            filename=doc.original_filename,
            file_type=doc.file_type,
            status=doc.status,
            error_msg=doc.error_msg,
            upload_date=doc.upload_date,
            user_id=doc.user_id,
            owner_email=owner_email,
        )
        for doc, owner_email in rows
    ]


@router.delete("/documents/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_any_document(
    document_id: int,
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> None:
    """Admin, sahibinden bağımsız olarak herhangi bir dokümanı siler.

    Silme PostgreSQL, ChromaDB ve fiziksel dosyayı kapsar (kullanıcı silme ile
    aynı `document_service` yardımcısı kullanılır).
    """
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doküman bulunamadı.",
        )
    delete_document_fully(db, document)
    return None


# --- İstatistikler -------------------------------------------------------


@router.get("/stats", response_model=StatsResponse)
def get_stats(
    _admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
) -> StatsResponse:
    """Sistem genel istatistiklerini döner."""
    total_users = db.scalar(select(func.count(User.id))) or 0
    active_users = db.scalar(
        select(func.count(User.id)).where(User.is_active.is_(True))
    ) or 0
    total_documents = db.scalar(select(func.count(Document.id))) or 0

    status_rows = db.execute(
        select(Document.status, func.count(Document.id)).group_by(Document.status)
    ).all()
    documents_by_status = {status_value: count for status_value, count in status_rows}

    return StatsResponse(
        total_users=total_users,
        active_users=active_users,
        total_documents=total_documents,
        documents_by_status=documents_by_status,
    )
