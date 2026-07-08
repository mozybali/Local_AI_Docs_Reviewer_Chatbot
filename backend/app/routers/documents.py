"""Doküman endpoint'leri (Hafta 1-2).

- `POST /documents/upload`: PDF/TXT/DOCX/görüntü yükler, dokümanı kullanıcıya
  ilişkilendirir ve işleme kuyruğuna (`processing_queue`) ekleyerek
  `202 Accepted` döner.
- `GET /documents`: Giriş yapmış kullanıcının dokümanlarını listeler.
- `GET /documents/{id}/status`: Doküman işleme durumunu döner.
- `POST /documents/{id}/reprocess`: Dokümanı yeniden işleme kuyruğuna alır
  (hatalı/kısmen işlenmiş dokümanlar için; dosya diskte durduğundan yeniden
  yükleme gerekmez).
- `DELETE /documents/{id}`: Dokümanı (chunk'lar + fiziksel dosya ile) siler.

Tüm okuma/silme işlemleri giriş yapmış kullanıcının `user_id` değeriyle
filtrelenir; başka kullanıcının dokümanına erişim `404` döner (varlığını
sızdırmamak için).
"""

from datetime import datetime
from pathlib import Path

from fastapi import (
    APIRouter,
    Depends,
    File,
    HTTPException,
    Request,
    UploadFile,
    status,
)
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.chunk import Chunk
from app.models.document import Document
from app.models.user import User
from app.services import file_service, processing_queue
from app.services.document_service import delete_document_fully
from app.utils.dependencies import enforce_user_rate_limit, get_current_user
from app.utils.file_validation import (
    FileValidationError,
    read_upload_limited,
    validate_upload,
)

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
    # Kısmi başarı uyarısı (doküman `ready` olsa bile bazı sayfalar okunamadı).
    warning_msg: str | None
    # Sayfa bazlı işleme istatistikleri (henüz işlenmediyse None).
    page_count: int | None
    pages_ocr: int | None
    pages_failed: int | None
    upload_date: datetime
    chunk_count: int


class DocumentStatus(BaseModel):
    document_id: int
    status: str
    error_msg: str | None
    warning_msg: str | None = None
    page_count: int | None = None
    pages_ocr: int | None = None
    pages_failed: int | None = None


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
    request: Request,
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> UploadResponse:
    """Dosya yükler ve async işlemeyi tetikler.

    Yanıt, işleme tamamlanmadan `202 Accepted` döner; ilerleme durum
    endpoint'i ile takip edilir.
    """
    # 0) Rate limit: işleme (metin çıkarma + embedding) maliyetli olduğundan
    #    kullanıcı + IP başına yükleme sıklığı sınırlanır (aşımda 429).
    enforce_user_rate_limit(
        request,
        current_user.id,
        scope="upload",
        attempts=settings.UPLOAD_RATE_LIMIT_ATTEMPTS,
        window_seconds=settings.UPLOAD_RATE_LIMIT_WINDOW_SECONDS,
    )

    # 1) Doğrulama: boyut sınırı okuma sırasında uygulanır (tamamı belleğe
    #    alınmadan), ardından uzantı/MIME/boş dosya kontrolleri yapılır.
    try:
        content = read_upload_limited(file.file)
        ext = validate_upload(file.filename or "", content)
    except FileValidationError as exc:
        raise HTTPException(status_code=exc.status_code, detail=exc.detail)

    # 2) Diske güvenli kayıt
    saved = file_service.save_upload(content, file.filename or "", ext)

    # 3) PostgreSQL'e doküman kaydı (sahip = current_user). Kayıt başarısız
    #    olursa diske az önce yazılan dosya yetim kalmasın diye temizlenir;
    #    böylece DB ile dosya sistemi tutarlı kalır.
    document = Document(
        user_id=current_user.id,
        filename=saved.stored_filename,
        original_filename=saved.original_filename,
        file_type=ext,
        file_path=saved.file_path,
        status="uploaded",
    )
    db.add(document)
    try:
        db.commit()
    except Exception:
        db.rollback()
        try:
            file_service.delete_file(saved.file_path)
        except (ValueError, OSError):
            pass
        raise
    db.refresh(document)

    # 4) Async işleme: adanmış worker thread'i işleri seri çalıştırır (aynı
    #    anda birçok yükleme CPU'yu boğup istekleri kilitleyemez).
    processing_queue.enqueue(document.id)

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
            warning_msg=doc.warning_msg,
            page_count=doc.page_count,
            pages_ocr=doc.pages_ocr,
            pages_failed=doc.pages_failed,
            upload_date=doc.upload_date,
            chunk_count=counts.get(doc.id, 0),
        )
        for doc in documents
    ]


def _document_status(document: Document) -> DocumentStatus:
    """Bir dokümanın durum yanıtını (sayfa istatistikleriyle) üretir."""
    return DocumentStatus(
        document_id=document.id,
        status=document.status,
        error_msg=document.error_msg,
        warning_msg=document.warning_msg,
        page_count=document.page_count,
        pages_ocr=document.pages_ocr,
        pages_failed=document.pages_failed,
    )


@router.get("/{document_id}/status", response_model=DocumentStatus)
def get_document_status(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentStatus:
    """Bir dokümanın işleme durumunu döner (yalnızca sahibine)."""
    document = _get_owned_document(db, document_id, current_user)
    return _document_status(document)


@router.post(
    "/{document_id}/reprocess",
    response_model=DocumentStatus,
    status_code=status.HTTP_202_ACCEPTED,
)
def reprocess_document(
    document_id: int,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> DocumentStatus:
    """Dokümanı yeniden işleme kuyruğuna alır (yalnızca sahibi).

    Hatalı (`error`) ya da kısmen işlenmiş (uyarılı `ready`) dokümanlar için
    kullanılır: dosya diskte durduğundan yeniden yüklemeye gerek yoktur. OCR
    motoru sonradan kurulduysa taranmış sayfalar bu yolla kazanılır.
    İşleme maliyetli olduğundan upload ile aynı rate limit uygulanır.
    """
    enforce_user_rate_limit(
        request,
        current_user.id,
        scope="upload",
        attempts=settings.UPLOAD_RATE_LIMIT_ATTEMPTS,
        window_seconds=settings.UPLOAD_RATE_LIMIT_WINDOW_SECONDS,
    )

    document = _get_owned_document(db, document_id, current_user)

    if document.status == "processing":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Doküman zaten işleniyor.",
        )

    if not document.file_path or not Path(document.file_path).is_file():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Dokümanın kaynak dosyası artık diskte yok. Lütfen dokümanı "
                "silip yeniden yükleyin."
            ),
        )

    document.status = "uploaded"
    document.error_msg = None
    document.warning_msg = None
    db.commit()
    db.refresh(document)

    processing_queue.enqueue(document.id)
    return _document_status(document)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(
    document_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> None:
    """Dokümanı siler: chunk kayıtları (cascade), ChromaDB vektörleri ve
    fiziksel dosya dahil.

    Silme sonrası bu dokümandan artık arama sonucu dönmemelidir.

    Silme mantığı (PostgreSQL + ChromaDB + fiziksel dosya) `document_service`
    içinde toplanır; admin silme endpoint'i de aynı yardımcıyı kullanır.
    """
    document = _get_owned_document(db, document_id, current_user)
    delete_document_fully(db, document)
    return None
