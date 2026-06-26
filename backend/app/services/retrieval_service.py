"""Retrieval servisi (Hafta 3).

Kullanıcı sorusunu embedding'e çevirir, ChromaDB üzerinde kullanıcının
`user_id` değerine göre filtrelenmiş top-k anlamsal arama yapar ve sonuçları
kaynak gösterimi için zenginleştirir (doküman adı, sayfa, skor, chunk index).

İzolasyon ve tutarlılık güvence altındadır:
1. ChromaDB sorgusu her zaman `user_id` ile filtrelenir (vektör tarafında).
2. Doküman adları yalnızca kullanıcının PostgreSQL'deki kendi dokümanlarından
   çözülür; başka kullanıcıya ait bir `document_id` sonuç olarak görünmez.
3. Yalnızca `status == "ready"` dokümanlar aramaya girer. Böylece silinmiş
   dokümanların yetim vektörleri ya da yeniden işleme yarıda kalmışken (PG
   commit edilmiş ama ChromaDB silme/yazma adımı patlamış) `error` durumda
   kalan dokümanların eski/tutarsız vektörleri sonuçlara karışmaz.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import settings
from app.models.document import Document
from app.services import embedding_service, vector_store

logger = logging.getLogger(__name__)


@dataclass(frozen=True)
class RetrievedChunk:
    """Aramadan dönen, kaynak bilgisiyle zenginleştirilmiş tek bir sonuç."""

    text: str
    score: float
    document_id: int
    document: str  # kullanıcıya gösterilen (orijinal) dosya adı
    page: int | None
    chunk_index: int


def search_chunks(
    db: Session,
    user_id: int,
    question: str,
    document_ids: list[int] | None = None,
    top_k: int | None = None,
) -> list[RetrievedChunk]:
    """Kullanıcının dokümanları içinde top-k anlamsal arama yapar.

    - `question`: kullanıcı sorusu (embedding'e çevrilir).
    - `document_ids`: verilirse arama yalnızca bu dokümanlarla sınırlanır;
      yalnızca kullanıcının sahip olduğu doküman ID'leri dikkate alınır.
    - `top_k`: sonuç sayısı (varsayılan `.env` içindeki `TOP_K`).
    """
    question = (question or "").strip()
    if not question:
        return []

    k = top_k if top_k is not None else settings.TOP_K

    # Aramayı baştan kullanıcının yalnızca `ready` dokümanlarıyla sınırla. Bu tek
    # PG sorgusu iki işi birden görür:
    #   - Chroma araması için kapsam (anahtarlar): eski/yetim/yarım vektörler hiç
    #     dönmez ve top-k'nın tamamı geçerli dokümanlardan gelir.
    #   - Sonuç zenginleştirmede {id: orijinal_dosya_adı} eşlemesi (ek sorgu yok).
    ready_docs = _ready_documents(db, user_id, document_ids)
    if not ready_docs:
        # Aranacak `ready` doküman yok (hiç yok ya da istenenler sahip değil/ready
        # değil): embedding üretmeden ve Chroma'ya gitmeden boş dön.
        return []

    query_embedding = embedding_service.embed_query(question)
    matches = vector_store.search(
        query_embedding=query_embedding,
        user_id=user_id,
        top_k=k,
        document_ids=list(ready_docs),
    )
    if not matches:
        return []

    results: list[RetrievedChunk] = []
    for match in matches:
        document_name = ready_docs.get(match.document_id)
        if document_name is None:
            # Pre-filtreye rağmen kalan tutarsızlık için backstop. Normalde
            # buraya düşülmez; ancak sorgu ile sonuç arasında doküman
            # silinmiş/değişmiş olabilir (yarış) ya da metadata kaymış olabilir.
            # Tek doğruluk kaynağı PostgreSQL olduğundan bu sonuçları eleriz.
            logger.warning(
                "Vektör elendi (PG'de ready doküman yok): document_id=%s "
                "vector_id=%s user_id=%s",
                match.document_id,
                match.vector_id,
                user_id,
            )
            continue
        results.append(
            RetrievedChunk(
                text=match.text,
                score=match.score,
                document_id=match.document_id,
                document=document_name,
                page=match.page_number,
                chunk_index=match.chunk_index,
            )
        )

    return results


def _ready_documents(
    db: Session, user_id: int, document_ids: list[int] | None
) -> dict[int, str]:
    """Kullanıcının `ready` dokümanlarını {id: orijinal_dosya_adı} döner.

    `document_ids` verilirse yalnızca o ID'lerle kesişim alınır (sahiplik + ready
    süzgeci birlikte uygulanır). `None` ise kullanıcının tüm `ready` dokümanları
    döner.

    Dönen sözlük hem ChromaDB aramasının kapsamını (anahtarlar) hem de sonuç
    zenginleştirmede dosya adı eşlemesini sağladığı için tek PG sorgusu yeterlidir.
    `status == "ready"` koşulu, yalnızca her iki depoda (PostgreSQL + ChromaDB)
    tutarlı şekilde işlenmiş dokümanların aramaya girmesini garanti eder;
    `processing`/`error` durumundaki bir dokümanın Chroma'da kalmış eski/yarım
    vektörleri sonuçlara karışamaz.
    """
    stmt = select(Document.id, Document.original_filename).where(
        Document.user_id == user_id,
        Document.status == "ready",
    )
    if document_ids:
        stmt = stmt.where(Document.id.in_(set(document_ids)))
    rows = db.execute(stmt).all()
    return {doc_id: filename for doc_id, filename in rows}
