"""Async doküman işleme orkestrasyonu.

`POST /documents/upload` isteği yanıtı bloke etmeden döner; gerçek işleme
FastAPI `BackgroundTasks` ile arka planda bu modüldeki `process_document`
fonksiyonu tarafından yürütülür.

Pipeline:
1. Doküman durumu `processing` yapılır.
2. Dosyadan metin sayfa sayfa çıkarılır.
3. Metin chunk'lara bölünür (512 token / 50 overlap).
4. Her chunk için embedding üretilir (Hafta 3).
5. Önce PostgreSQL: eski chunk'lar silinip yeni chunk'lar yazılır ve COMMIT
   edilir (PostgreSQL tek doğruluk kaynağıdır). Her chunk'ın `vector_id` alanı
   ilgili ChromaDB vektörüyle deterministik olarak ilişkilendirilir.
6. Sonra ChromaDB: eski vektörler silinip yeni vektörler metadata ile
   (`user_id`, `document_id`, `page`, `chunk_index`) yazılır. `add_vectors`
   upsert olduğu için bu adım idempotenttir/yeniden çalıştırılabilir.
7. Doküman durumu YALNIZCA her iki depo da tutarlıyken `ready` yapılır;
   ChromaDB adımı başarısız olursa durum `error` (+ `error_msg`) kalır ve
   yeniden işlemede (veya `scripts/reindex.py` ile) düzelir.

Önemli: Background task, request-scoped `get_db` oturumunu kullanamaz (yanıt
gönderildikten sonra kapanır). Bu yüzden burada kendi `SessionLocal` oturumu
açılır.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy import select

from app.database import SessionLocal
from app.models.chunk import Chunk
from app.models.document import Document
from app.services import embedding_service, ocr_service, vector_store
from app.services.chunker import chunk_pages
from app.services.text_extractor import (
    SOURCE_EMPTY,
    SOURCE_FAILED,
    SOURCE_NATIVE,
    SOURCE_OCR,
    ExtractedPage,
    TextExtractionError,
    extract_pages,
)

logger = logging.getLogger(__name__)


def _vector_id(document_id: int, chunk_index: int) -> str:
    """Bir chunk için deterministik (yeniden işlemede kararlı) vektör kimliği."""
    return f"doc{document_id}_chunk{chunk_index}"


@dataclass(frozen=True)
class PageStats:
    """Sayfa bazlı çıkarım istatistikleri (loglama + kullanıcı raporu)."""

    total: int
    native: int
    ocr: int
    empty: int
    failed: int
    failed_pages: tuple[int, ...]


def _collect_page_stats(pages: list[ExtractedPage]) -> PageStats:
    """Çıkarılan sayfalardan kaynak bazlı istatistik üretir."""
    counts = {SOURCE_NATIVE: 0, SOURCE_OCR: 0, SOURCE_EMPTY: 0, SOURCE_FAILED: 0}
    failed_pages: list[int] = []
    for page in pages:
        counts[page.source] = counts.get(page.source, 0) + 1
        if page.source == SOURCE_FAILED:
            failed_pages.append(page.page_number)
    return PageStats(
        total=len(pages),
        native=counts[SOURCE_NATIVE],
        ocr=counts[SOURCE_OCR],
        empty=counts[SOURCE_EMPTY],
        failed=counts[SOURCE_FAILED],
        failed_pages=tuple(failed_pages),
    )


def _format_page_list(pages: tuple[int, ...], limit: int = 10) -> str:
    """Sayfa listesini kullanıcı mesajı için kısaltarak biçimler."""
    shown = ", ".join(str(p) for p in pages[:limit])
    if len(pages) > limit:
        shown += f" … (+{len(pages) - limit})"
    return shown


def _no_text_error_message(stats: PageStats) -> str:
    """Hiç chunk üretilemediğinde nedene göre açıklayıcı hata mesajı üretir."""
    if stats.failed > 0:
        if not ocr_service.is_available():
            return (
                "Bu doküman taranmış görünüyor (metin katmanı yok) ve hiçbir "
                "OCR motoru kullanılamıyor. Sunucuya Tesseract kurun veya "
                "`pip install easyocr` çalıştırıp dokümanı yeniden işleyin."
            )
        return (
            "Dokümandaki sayfalar OCR ile de okunamadı. Tarama kalitesi çok "
            "düşük olabilir; daha yüksek çözünürlüklü bir kopya deneyin."
        )
    return "Dokümandan metin çıkarılamadı veya doküman boş."


def _partial_warning_message(stats: PageStats) -> str | None:
    """Kısmi başarı durumunda kullanıcıya gösterilecek uyarıyı üretir."""
    if stats.failed <= 0:
        return None
    message = (
        f"{stats.failed}/{stats.total} sayfadan metin çıkarılamadı "
        f"(sayfa: {_format_page_list(stats.failed_pages)}). "
        "Bu sayfalar aramaya dahil değildir."
    )
    if not ocr_service.is_available():
        message += (
            " OCR motoru kurulamadığı için taranmış sayfalar okunamadı; "
            "Tesseract veya EasyOCR kurup 'Yeniden işle' deneyin."
        )
    return message


def process_document(document_id: int) -> None:
    """Bir dokümanı arka planda işler (metin çıkarma + chunking + embedding)."""
    db = SessionLocal()
    try:
        document = db.get(Document, document_id)
        if document is None:
            logger.warning("İşlenecek doküman bulunamadı: id=%s", document_id)
            return

        document.status = "processing"
        document.error_msg = None
        document.warning_msg = None
        db.commit()

        try:
            pages = extract_pages(document.file_path, document.file_type)
            stats = _collect_page_stats(pages)
            logger.info(
                "Sayfa raporu: id=%s toplam=%s native=%s ocr=%s bos=%s "
                "basarisiz=%s%s",
                document_id,
                stats.total,
                stats.native,
                stats.ocr,
                stats.empty,
                stats.failed,
                f" basarisiz_sayfalar={list(stats.failed_pages)}"
                if stats.failed_pages
                else "",
            )

            # Sayfa istatistiklerini kaydet (durumdan bağımsız gözlemlenebilirlik).
            document.page_count = stats.total
            document.pages_ocr = stats.ocr
            document.pages_failed = stats.failed

            # Chunk boyutunu embedding modelinin GERÇEK tokenizer'ı ile ölç ve
            # modelin girdi limitiyle sınırla; böylece chunk'lar embedding
            # sırasında sessizce kırpılmaz. Model yüklenemezse kelime vekiline
            # düşülür (embed_texts zaten aynı modeli birazdan yükleyecek).
            token_counter = embedding_service.try_get_token_counter()
            max_tokens = embedding_service.try_get_max_seq_tokens()
            chunks = chunk_pages(
                pages, token_counter=token_counter, max_tokens=max_tokens
            )

            if not chunks:
                document.status = "error"
                document.error_msg = _no_text_error_message(stats)
                db.commit()
                logger.info(
                    "Dokümandan hiç chunk üretilemedi: id=%s (%s)",
                    document_id,
                    document.error_msg,
                )
                return

            # Kısmi başarı: bazı sayfalar okunamadıysa kullanıcıya raporlanır
            # (doküman yine `ready` olur; okunabilen sayfalar aranabilir).
            warning = _partial_warning_message(stats)
            if warning:
                logger.warning(
                    "Kısmi çıkarım: id=%s %s", document_id, warning
                )

            # Her chunk için embedding üret (toplu/batch).
            embeddings = embedding_service.embed_texts([c.text for c in chunks])

            # Sayfa numarası -> çıkarım meta bilgisi (chunk metadata'sı için).
            page_meta = {p.page_number: p for p in pages}

            # Chunk satırlarını ve ChromaDB vektör kayıtlarını birlikte hazırla.
            chunk_rows: list[Chunk] = []
            records: list[vector_store.VectorRecord] = []
            for chunk, embedding in zip(chunks, embeddings):
                vid = _vector_id(document.id, chunk.chunk_index)
                meta = page_meta.get(chunk.page_number)
                source_type = meta.source if meta else None
                ocr_confidence = meta.ocr_confidence if meta else None
                chunk_rows.append(
                    Chunk(
                        document_id=document.id,
                        chunk_text=chunk.text,
                        page_number=chunk.page_number,
                        chunk_index=chunk.chunk_index,
                        vector_id=vid,
                        source_type=source_type,
                        ocr_confidence=ocr_confidence,
                    )
                )
                records.append(
                    vector_store.VectorRecord(
                        vector_id=vid,
                        embedding=embedding,
                        text=chunk.text,
                        user_id=document.user_id,
                        document_id=document.id,
                        chunk_index=chunk.chunk_index,
                        page_number=chunk.page_number,
                        source_type=source_type,
                        ocr_confidence=ocr_confidence,
                    )
                )

            # İki depoya transactional yazamadığımız için tutarlılığı, sıra +
            # idempotency ile kuruyoruz (PostgreSQL = tek doğruluk kaynağı):
            #
            # 1) Önce PostgreSQL: eski chunk'ları sil, yenilerini ekle, COMMIT.
            #    Bu noktada doküman hâlâ "processing"tir.
            db.query(Chunk).filter(Chunk.document_id == document.id).delete()
            db.add_all(chunk_rows)
            db.commit()

            # 2) Sonra ChromaDB: eski vektörleri sil, yenilerini yaz. `vector_id`
            #    deterministik ve `add_vectors` upsert olduğu için bu adım
            #    yeniden çalıştırılabilir (idempotent). Bu adım patlarsa aşağıdaki
            #    `VectorStoreError` yakalanır ve doküman "error" yapılır; yani
            #    ChromaDB başarısızken doküman ASLA "ready" olmaz.
            vector_store.delete_by_document(document.id)
            vector_store.add_vectors(records)

            # 3) Yarış durumu koruması: uzun süren embedding/vektör adımları
            #    sırasında doküman kullanıcı/admin tarafından silinmiş olabilir.
            #    Silinmişse az önce yazdığımız vektörler yetimdir; "ready"
            #    yapmadan temizleyip çıkarız (retrieval zaten PG'de karşılığı
            #    olmayan vektörleri eler, bu adım depoyu da temiz tutar).
            #    Kimlik haritasını atlamak için saf kolon sorgusu kullanılır.
            still_exists = db.execute(
                select(Document.id).where(Document.id == document_id)
            ).scalar_one_or_none()
            if still_exists is None:
                logger.info(
                    "Doküman işleme sırasında silinmiş; vektörler temizleniyor: "
                    "id=%s",
                    document_id,
                )
                vector_store.delete_by_document(document_id)
                return

            # 4) Her iki depo da tutarlı: ancak şimdi "ready".
            document.status = "ready"
            document.error_msg = None
            document.warning_msg = warning
            db.commit()
            logger.info(
                "Doküman işlendi: id=%s chunk_sayisi=%s embedding_sayisi=%s "
                "(native=%s ocr=%s basarisiz=%s)",
                document_id,
                len(chunks),
                len(embeddings),
                stats.native,
                stats.ocr,
                stats.failed,
            )

        except TextExtractionError as exc:
            db.rollback()
            _mark_error(db, document_id, str(exc))
        except embedding_service.EmbeddingError:
            logger.exception("Embedding üretilemedi: id=%s", document_id)
            db.rollback()
            _mark_error(
                db,
                document_id,
                "Embedding modeli yüklenemedi. Lütfen tekrar deneyin.",
            )
        except vector_store.VectorStoreError:
            logger.exception("Vektör deposu hatası: id=%s", document_id)
            db.rollback()
            _mark_error(
                db,
                document_id,
                "Vektörler kaydedilemedi. Vektör veritabanına ulaşılamadı.",
            )
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
    document.warning_msg = None
    db.commit()
