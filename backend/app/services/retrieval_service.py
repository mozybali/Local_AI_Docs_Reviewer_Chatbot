"""Retrieval servisi (Hafta 3).

Kullanıcı sorusunu embedding'e çevirir, ChromaDB üzerinde kullanıcının
`user_id` değerine göre filtrelenmiş top-k anlamsal arama yapar ve sonuçları
kaynak gösterimi için zenginleştirir (doküman adı, sayfa, skor, chunk index).

İzolasyon iki kat güvence altındadır:
1. ChromaDB sorgusu her zaman `user_id` ile filtrelenir (vektör tarafında).
2. Doküman adları yalnızca kullanıcının PostgreSQL'deki kendi dokümanlarından
   çözülür; başka kullanıcıya ait bir `document_id` sonuç olarak görünmez.
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

    # İstenen doküman ID'lerini kullanıcının sahip olduklarıyla sınırla.
    owned_ids = _owned_document_ids(db, user_id, document_ids)
    if document_ids and not owned_ids:
        # Kullanıcı yalnızca sahibi olmadığı doküman(lar) istedi: boş sonuç.
        return []

    query_embedding = embedding_service.embed_query(question)
    matches = vector_store.search(
        query_embedding=query_embedding,
        user_id=user_id,
        top_k=k,
        document_ids=owned_ids or None,
    )
    if not matches:
        return []

    # Sonuçlardaki dokümanların orijinal adlarını tek sorguda çöz.
    filenames = _document_filenames(
        db, user_id, [m.document_id for m in matches]
    )

    return [
        RetrievedChunk(
            text=match.text,
            score=match.score,
            document_id=match.document_id,
            document=filenames.get(match.document_id, "(bilinmeyen doküman)"),
            page=match.page_number,
            chunk_index=match.chunk_index,
        )
        for match in matches
    ]


def _owned_document_ids(
    db: Session, user_id: int, document_ids: list[int] | None
) -> list[int]:
    """İstenen doküman ID'lerinden kullanıcıya ait olanları döner."""
    if not document_ids:
        return []
    rows = db.scalars(
        select(Document.id).where(
            Document.user_id == user_id,
            Document.id.in_(document_ids),
        )
    ).all()
    return list(rows)


def _document_filenames(
    db: Session, user_id: int, document_ids: list[int]
) -> dict[int, str]:
    """Doküman ID -> orijinal dosya adı eşlemesini (kullanıcı bazlı) döner."""
    unique_ids = list({doc_id for doc_id in document_ids})
    if not unique_ids:
        return {}
    rows = db.execute(
        select(Document.id, Document.original_filename).where(
            Document.user_id == user_id,
            Document.id.in_(unique_ids),
        )
    ).all()
    return {doc_id: filename for doc_id, filename in rows}
