"""Doküman endpoint'leri (Hafta 1-2).

- `POST /documents/upload`: PDF/TXT/DOCX yükler, dokümanı kullanıcıya
  ilişkilendirir ve async işlemeyi (`BackgroundTasks`) tetikleyerek
  `202 Accepted` döner.
- `GET /documents`: Giriş yapmış kullanıcının dokümanlarını listeler.
- `GET /documents/{id}/status`: Doküman işleme durumunu döner.
- `DELETE /documents/{id}`: Dokümanı (chunk'lar + fiziksel dosya ile) siler.

Tüm okuma/silme işlemleri giriş yapmış kullanıcının `user_id` değeriyle
filtrelenir; başka kullanıcının dokümanına erişim `404` döner (varlığını
sızdırmamak için).
"""

from datetime import datetime

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    HTTPException,
    UploadFile,
    status,
)
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.chunk import Chunk
from app.models.document import Document
from app.models.user import User
from app.services import file_service, vector_store
from app.services.document_processor import process_document
from app.utils.dependencies import get_current_user
from app.utils.file_validation import FileValidationError, validate_upload

router = APIRouter(prefix="/documents", tags=["documents"])


# --- Şemalar -------------------------------------------------------------


class UploadResponse(BaseModel):
    document_id: int
    filename: str
    status: str


class DocumentRead(BaseModel):
    id: int
    filename: str  # kullanıcıya gösterilen (orijinal) dosya adı
    file_type: str
    status: str
    error_msg: str | None
    upload_date: datetime
    chunk_count: int


class DocumentStatus(BaseModel):
    document_id: int
    status: str
    error_msg: str | None


# --- Yardımcılar ---------------------------------------------------------


def _get_owned_document(db: Session, document_id: int, user: User) -> Document:
    """Dokümanı döner; yoksa veya kullanıcıya ait değilse `404` fırlatır."""
    document = db.get(Document, document_id)
    if document is None or document.user_id != user.id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Doküman bulunamadı.",
        )
    return document


# --- Endpoint'ler --------------------------------------------------------


@router.post(
    "/upload",
    response_model=UploadResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def upload_document(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UploadResponse:
    """Dosya yükler ve async işlemeyi tetikler.

    Yanıt, işleme tamamlanmadan `202 Accepted` döner; ilerleme durum
    endpoint'i ile takip edilir.
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

    # 4) Async işleme: yanıt gönderildikten sonra arka planda çalışır.
    background_tasks.add_task(process_document, document.id)

    return UploadResponse(
        document_id=document.id,
        filename=document.original_filename,
        status=document.status,
    )


@router.get("", response_model=list[DocumentRead])
def list_documents(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[DocumentRead]:
    """Giriş yapmış kullanıcının dokümanlarını (chunk sayısıyla) listeler."""
    documents = db.scalars(
        select(Document)
        .where(Document.user_id == current_user.id)
        .order_by(Document.upload_date.desc())
    ).all()

    if not documents:
        return []

    # Chunk sayılarını tek sorguda topla (N+1 yerine grouped count).
    counts = dict(
        db.execute(
            select(Chunk.document_id, func.count(Chunk.id))
            .where(Chunk.document_id.in_([d.id for d in documents]))
            .group_by(Chunk.document_id)
        ).all()
    )

    return [
        DocumentRead(
            id=doc.id,
            filename=doc.original_filename,
            file_type=doc.file_type,
            status=doc.status,
            error_msg=doc.error_msg,
            upload_date=doc.upload_date,
            chunk_count=counts.get(doc.id, 0),
        )
        for doc in documents
    ]


@router.get("/{document_id}/status", response_model=DocumentStatus)
def get_document_status(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentStatus:
    """Bir dokümanın işleme durumunu döner (yalnızca sahibine)."""
    document = _get_owned_document(db, document_id, current_user)
    return DocumentStatus(
        document_id=document.id,
        status=document.status,
        error_msg=document.error_msg,
    )


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Dokümanı siler: chunk kayıtları (cascade), ChromaDB vektörleri ve
    fiziksel dosya dahil.

    Silme sonrası bu dokümandan artık arama sonucu dönmemelidir.
    """
    document = _get_owned_document(db, document_id, current_user)
    file_path = document.file_path

    # ChromaDB vektörlerini sil (DB silmeden önce; başarısız olursa doküman
    # silinmez ve kullanıcı tekrar deneyebilir).
    try:
        vector_store.delete_by_document(document.id)
    except vector_store.VectorStoreError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Vektör veritabanına ulaşılamadı. Doküman silinemedi.",
        ) from exc

    # ORM silme: Document.chunks ilişkisindeki cascade ile chunk'lar da silinir.
    db.delete(document)
    db.commit()

    # Fiziksel dosyayı sil (DB tutarlılığı korunduktan sonra; hata yutulur).
    try:
        file_service.delete_file(file_path)
    except ValueError:
        pass

    return None
