"""Async doküman işleme orkestrasyonu.

`POST /documents/upload` isteği yanıtı bloke etmeden döner; gerçek işleme
FastAPI `BackgroundTasks` ile arka planda bu modüldeki `process_document`
fonksiyonu tarafından yürütülür.

Pipeline:
1. Doküman durumu `processing` yapılır.
2. Dosyadan metin sayfa sayfa çıkarılır.
3. Metin chunk'lara bölünür (512 token / 50 overlap).
4. Chunk'lar PostgreSQL `chunks` tablosuna yazılır.
5. Başarılıysa durum `ready`, hatada `error` (+ `error_msg`) yapılır.

Embedding üretimi ve ChromaDB kaydı Hafta 3'te bu pipeline'a eklenecektir.

Önemli: Background task, request-scoped `get_db` oturumunu kullanamaz (yanıt
gönderildikten sonra kapanır). Bu yüzden burada kendi `SessionLocal` oturumu
açılır.
"""

from __future__ import annotations

import logging

from app.database import SessionLocal
from app.models.chunk import Chunk
from app.models.document import Document
from app.services.chunker import chunk_pages
from app.services.text_extractor import TextExtractionError, extract_pages

logger = logging.getLogger(__name__)


def process_document(document_id: int) -> None:
    """Bir dokümanı arka planda işler (metin çıkarma + chunking)."""
    db = SessionLocal()
    try:
        document = db.get(Document, document_id)
        if document is None:
            logger.warning("İşlenecek doküman bulunamadı: id=%s", document_id)
            return

        document.status = "processing"
        document.error_msg = None
        db.commit()

        try:
            pages = extract_pages(document.file_path, document.file_type)
            chunks = chunk_pages(pages)

            if not chunks:
                document.status = "error"
                document.error_msg = (
                    "Dokümandan metin çıkarılamadı veya doküman boş."
                )
                db.commit()
                logger.info("Doküman boş/metin yok: id=%s", document_id)
                return

            # Yeniden işlemede tekrar oluşmasın diye eski chunk'ları temizle.
            db.query(Chunk).filter(Chunk.document_id == document.id).delete()
            db.add_all(
                Chunk(
                    document_id=document.id,
                    chunk_text=c.text,
                    page_number=c.page_number,
                    chunk_index=c.chunk_index,
                )
                for c in chunks
            )

            document.status = "ready"
            document.error_msg = None
            db.commit()
            logger.info(
                "Doküman işlendi: id=%s chunk_sayisi=%s", document_id, len(chunks)
            )

        except TextExtractionError as exc:
            db.rollback()
            _mark_error(db, document_id, str(exc))
        except Exception:
            logger.exception("Doküman işlenirken beklenmeyen hata: id=%s", document_id)
            db.rollback()
            _mark_error(
                db, document_id, "Doküman işlenirken beklenmeyen bir hata oluştu."
            )
    finally:
        db.close()


def _mark_error(db, document_id: int, message: str) -> None:
    """Dokümanı `error` durumuna alır ve hata mesajını kaydeder."""
    document = db.get(Document, document_id)
    if document is None:
        return
    document.status = "error"
    document.error_msg = message
    db.commit()
