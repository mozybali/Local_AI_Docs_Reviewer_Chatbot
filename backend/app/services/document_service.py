"""Doküman yaşam döngüsü yardımcıları.

Doküman silme, üç ayrı veri deposunu (PostgreSQL, ChromaDB, fiziksel dosya)
kapsadığı için birden çok yerde (kullanıcı silme `documents` router'ı ve admin
silme `admin` router'ı) ihtiyaç duyulur. Mantığı tek bir yerde toplamak için
buraya alınmıştır.
"""

from __future__ import annotations

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.document import Document
from app.services import file_service, vector_store

logger = logging.getLogger(__name__)

# İşleme kuyruğu süreç içi (BackgroundTasks) olduğundan, sunucu kapanınca bu
# durumlardaki dokümanların görevi bir daha ASLA çalışmaz; başlangıçta `error`
# durumuna alınmazlarsa arayüzde sonsuza dek "İşleniyor" görünürler.
_STALE_STATUSES = ("uploaded", "processing")

_STALE_ERROR_MESSAGE = (
    "İşleme, sunucu yeniden başlatıldığı için yarıda kaldı. "
    "'Yeniden işle' ile tekrar deneyebilirsiniz."
)


def recover_stale_documents(db: Session) -> int:
    """Başlangıçta yarıda kalmış (`uploaded`/`processing`) dokümanları işaretler.

    Tek instance varsayımıyla çalışır (rate limiter ile aynı MVP varsayımı):
    uygulama başlarken bu durumda görünen her doküman, önceki sürecin yarıda
    kalan işidir. `error` durumuna alınır ki kullanıcı durumu görüp yeniden
    yükleyebilsin (ya da `scripts/reindex.py --fix` ile onarılabilsin).
    İşaretlenen doküman sayısını döner.
    """
    stale = db.scalars(
        select(Document).where(Document.status.in_(_STALE_STATUSES))
    ).all()
    for document in stale:
        document.status = "error"
        document.error_msg = _STALE_ERROR_MESSAGE
    if stale:
        db.commit()
        logger.warning(
            "Yarıda kalmış %s doküman 'error' durumuna alındı: %s",
            len(stale),
            [d.id for d in stale],
        )
    return len(stale)


def delete_document_fully(db: Session, document: Document) -> None:
    """Bir dokümanı tüm depolardan eksiksiz siler.

    Sıra (PostgreSQL tek doğruluk kaynağı olduğu için):
    1. PostgreSQL kaydı (ORM cascade ile chunk'lar da) silinip COMMIT edilir.
    2. ChromaDB vektörleri silinir.
    3. Fiziksel dosya silinir.

    DB commit'i patlarsa hiçbir şey kaybolmaz. ChromaDB silme patlarsa geriye
    yalnızca "yetim" vektör kalır; bunlar retrieval tarafında (PG'de karşılığı
    olmadığı için) sonuçlardan elenir ve `scripts/reindex.py --check` ile
    temizlenebilir. Bu nedenle ChromaDB/dosya hataları isteği başarısız saymaz.
    """
    document_id = document.id
    file_path = document.file_path

    # 1) PostgreSQL: ORM silme — Document.chunks cascade'i ile chunk'lar da gider.
    db.delete(document)
    db.commit()

    # 2) ChromaDB: vektörleri sil. Patlarsa isteği başarısız saymayız.
    try:
        vector_store.delete_by_document(document_id)
    except vector_store.VectorStoreError:
        logger.warning(
            "Doküman DB'den silindi ama ChromaDB vektörleri silinemedi "
            "(yetim vektör kaldı): document_id=%s",
            document_id,
        )

    # 3) Fiziksel dosyayı sil (hata yutulur).
    try:
        file_service.delete_file(file_path)
    except ValueError:
        pass
