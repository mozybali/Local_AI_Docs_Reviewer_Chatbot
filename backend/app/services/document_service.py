"""Doküman yaşam döngüsü yardımcıları.

Doküman silme, üç ayrı veri deposunu (PostgreSQL, ChromaDB, fiziksel dosya)
kapsadığı için birden çok yerde (kullanıcı silme `documents` router'ı ve admin
silme `admin` router'ı) ihtiyaç duyulur. Mantığı tek bir yerde toplamak için
buraya alınmıştır.
"""

from __future__ import annotations

import logging

from sqlalchemy.orm import Session

from app.models.document import Document
from app.services import file_service, vector_store

logger = logging.getLogger(__name__)


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
