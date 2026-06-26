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

from app.database import SessionLocal
from app.models.chunk import Chunk
from app.models.document import Document
from app.services import embedding_service, vector_store
from app.services.chunker import chunk_pages
from app.services.text_extractor import TextExtractionError, extract_pages

logger = logging.getLogger(__name__)


def _vector_id(document_id: int, chunk_index: int) -> str:
    """Bir chunk için deterministik (yeniden işlemede kararlı) vektör kimliği."""
    return f"doc{document_id}_chunk{chunk_index}"


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

            # Her chunk için embedding üret (toplu/batch).
            embeddings = embedding_service.embed_texts([c.text for c in chunks])

            # Chunk satırlarını ve ChromaDB vektör kayıtlarını birlikte hazırla.
            chunk_rows: list[Chunk] = []
            records: list[vector_store.VectorRecord] = []
            for chunk, embedding in zip(chunks, embeddings):
                vid = _vector_id(document.id, chunk.chunk_index)
                chunk_rows.append(
                    Chunk(
                        document_id=document.id,
                        chunk_text=chunk.text,
                        page_number=chunk.page_number,
                        chunk_index=chunk.chunk_index,
                        vector_id=vid,
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

            # 3) Her iki depo da tutarlı: ancak şimdi "ready".
            document.status = "ready"
            document.error_msg = None
            db.commit()
            logger.info(
                "Doküman işlendi: id=%s chunk_sayisi=%s", document_id, len(chunks)
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
    db.commit()
