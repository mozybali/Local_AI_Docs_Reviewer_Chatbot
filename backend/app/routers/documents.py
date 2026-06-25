"""Doküman endpoint'leri.

1. Hafta kapsamında yalnızca korumalı dosya yükleme (`POST /documents/upload`)
uygulanır. Async işleme, listeleme, durum sorgulama ve silme 2. haftada
eklenecektir.

Yükleme yalnızca giriş yapmış kullanıcılara açıktır ve doküman, yükleyen
kullanıcının `user_id` değeriyle ilişkilendirilir.
"""

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.document import Document
from app.models.user import User
from app.services import file_service
from app.utils.dependencies import get_current_user
from app.utils.file_validation import FileValidationError, validate_upload

router = APIRouter(prefix="/documents", tags=["documents"])


class UploadResponse(BaseModel):
    document_id: int
    filename: str
    status: str


@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_201_CREATED,
)
def upload_document(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UploadResponse:
    """PDF veya TXT dosyası yükler ve dokümanı kullanıcıya ilişkilendirir.

    Token yoksa `get_current_user` `401` döner. Doğrulama başarısız olursa
    açıklayıcı bir hata mesajı (`400/413/415`) döner.
    """
    content = file.file.read()

    # 1) Doğrulama (uzantı, boyut, MIME, boş dosya)
    try:
        ext = validate_upload(file.filename or "", content)
    except FileValidationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    # 2) Diske güvenli kayıt
    saved = file_service.save_upload(content, file.filename or "", ext)

    # 3) PostgreSQL'e doküman kaydı (sahip = current_user)
    document = Document(
        user_id=current_user.id,
        filename=saved.stored_filename,
        original_filename=saved.original_filename,
        file_type=ext,
        file_path=saved.file_path,
        status="uploaded",
    )
    db.add(document)
    db.commit()
    db.refresh(document)

    return UploadResponse(
        document_id=document.id,
        filename=document.original_filename,
        status=document.status,
    )
