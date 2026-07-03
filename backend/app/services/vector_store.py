"""ChromaDB vektör deposu servisi (Hafta 3).

Chunk embedding'lerini metadata ile birlikte kalıcı (persistent) bir ChromaDB
koleksiyonunda saklar ve kullanıcı bazlı izolasyonlu anlamsal arama sağlar.

Çok kullanıcılı izolasyon: Her vektörün metadata'sına `user_id` yazılır.
Sorgular her zaman `where={"user_id": ...}` filtresiyle sınırlandırılır; böylece
bir kullanıcının araması asla başka kullanıcının chunk'larını döndürmez.

Mesafe ölçütü olarak kosinüs (`hnsw:space=cosine`) kullanılır; embedding'ler
zaten normalize edildiği için sonuçlar tutarlıdır. Skor, mesafeden türetilir:
`score = 1 - distance` (1.0'a yakın = daha benzer).

Koleksiyon istemcisi süreç başına bir kez (singleton) oluşturulur ve persist
dizini `.env` içindeki `CHROMA_PERSIST_DIR` değerinden alınır.
"""

from __future__ import annotations

import logging
import threading
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path
from typing import TYPE_CHECKING, Any

from app.config import settings

if TYPE_CHECKING:  # pragma: no cover - yalnızca tip denetimi için
    from chromadb.api.models.Collection import Collection

logger = logging.getLogger(__name__)

# backend/ kök dizini: app/services/vector_store.py -> parents[2] == backend/
BASE_DIR = Path(__file__).resolve().parents[2]

_client_lock = threading.Lock()

# ChromaDB (SQLite backend) tek çağrıda ~5461 kayıt kabul eder
# (client.get_max_batch_size()); üstü ValueError ile reddedilir. Büyük
# dokümanlar (ör. 50MB TXT binlerce chunk üretir) bu sınırı aşabileceğinden
# upsert güvenli bir dilim boyutuyla parçalanır.
_UPSERT_BATCH_SIZE = 4096


class VectorStoreError(Exception):
    """Vektör deposu işlemleri sırasında oluşan hata."""


@dataclass(frozen=True)
class VectorRecord:
    """ChromaDB'ye yazılacak tek bir vektör kaydı."""

    vector_id: str
    embedding: list[float]
    text: str
    user_id: int
    document_id: int
    chunk_index: int
    page_number: int | None


@dataclass(frozen=True)
class VectorMatch:
    """Aramadan dönen tek bir eşleşme (skor + metadata)."""

    vector_id: str
    text: str
    score: float
    document_id: int
    chunk_index: int
    page_number: int | None


def _resolve_persist_dir() -> str:
    """`CHROMA_PERSIST_DIR` değerini backend köküne göre çözümler."""
    persist = Path(settings.CHROMA_PERSIST_DIR)
    resolved = persist if persist.is_absolute() else BASE_DIR / persist
    resolved.mkdir(parents=True, exist_ok=True)
    return str(resolved)


@lru_cache(maxsize=1)
def _get_collection() -> "Collection":
    """Kalıcı ChromaDB koleksiyonunu (gerekirse oluşturarak) döner."""
    try:
        import chromadb
        from chromadb.config import Settings as ChromaSettings
    except ImportError as exc:  # pragma: no cover - bağımlılık eksikse
        raise VectorStoreError("ChromaDB kurulu değil.") from exc

    try:
        client = chromadb.PersistentClient(
            path=_resolve_persist_dir(),
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        collection = client.get_or_create_collection(
            name=settings.CHROMA_COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(
            "ChromaDB koleksiyonu hazır: %s", settings.CHROMA_COLLECTION_NAME
        )
        return collection
    except Exception as exc:
        raise VectorStoreError(
            "ChromaDB koleksiyonuna bağlanılamadı."
        ) from exc


def get_collection() -> "Collection":
    """Koleksiyon singleton'ını döner (thread-safe)."""
    with _client_lock:
        return _get_collection()


def add_vectors(records: list[VectorRecord]) -> None:
    """Vektör kayıtlarını metadata ile birlikte ChromaDB'ye yazar.

    Aynı `vector_id` ile çağrılırsa kayıt güncellenir (upsert), böylece
    yeniden işleme mükerrer vektör oluşturmaz. Kayıtlar ChromaDB'nin tek
    çağrı sınırını aşmamak için `_UPSERT_BATCH_SIZE` boyutlu dilimler halinde
    yazılır; `vector_id` deterministik olduğundan yarıda kalan bir yazım
    yeniden çalıştırmada güvenle tamamlanır (idempotent).
    """
    if not records:
        return

    collection = get_collection()
    try:
        for start in range(0, len(records), _UPSERT_BATCH_SIZE):
            batch = records[start : start + _UPSERT_BATCH_SIZE]
            collection.upsert(
                ids=[r.vector_id for r in batch],
                embeddings=[r.embedding for r in batch],
                documents=[r.text for r in batch],
                metadatas=[
                    {
                        "user_id": r.user_id,
                        "document_id": r.document_id,
                        "chunk_index": r.chunk_index,
                        # ChromaDB None metadata kabul etmez; -1 "sayfa yok"
                        # demektir.
                        "page": r.page_number if r.page_number is not None else -1,
                    }
                    for r in batch
                ],
            )
    except Exception as exc:
        raise VectorStoreError(
            "Vektörler ChromaDB'ye yazılırken hata oluştu."
        ) from exc


def search(
    query_embedding: list[float],
    user_id: int,
    top_k: int = 5,
    document_ids: list[int] | None = None,
) -> list[VectorMatch]:
    """Kullanıcının `user_id` değerine göre filtrelenmiş top-k arama yapar.

    `document_ids` verilirse arama yalnızca o dokümanlarla sınırlandırılır.
    Sonuçlar skora göre azalan sırada döner.
    """
    collection = get_collection()

    where = _build_where(user_id, document_ids)

    try:
        result = collection.query(
            query_embeddings=[query_embedding],
            n_results=top_k,
            where=where,
            include=["documents", "metadatas", "distances"],
        )
    except Exception as exc:
        raise VectorStoreError("Vektör araması başarısız oldu.") from exc

    return _parse_results(result)


def delete_by_document(document_id: int) -> None:
    """Bir dokümana ait tüm vektörleri ChromaDB'den siler."""
    collection = get_collection()
    try:
        collection.delete(where={"document_id": document_id})
    except Exception as exc:
        raise VectorStoreError(
            "ChromaDB'den vektör silinirken hata oluştu."
        ) from exc


def count_by_document(document_id: int) -> int:
    """Bir dokümana ait ChromaDB'deki vektör sayısını döner (test/teşhis)."""
    collection = get_collection()
    try:
        result = collection.get(where={"document_id": document_id})
    except Exception as exc:
        raise VectorStoreError("ChromaDB sorgusu başarısız oldu.") from exc
    return len(result.get("ids") or [])


# --- Yardımcılar ---------------------------------------------------------


def _build_where(user_id: int, document_ids: list[int] | None) -> dict[str, Any]:
    """ChromaDB `where` filtresini oluşturur (kullanıcı izolasyonu zorunlu).

    Tek koşulda düz filtre; birden fazla koşulda ChromaDB `$and` operatörü
    gerekir.
    """
    user_clause: dict[str, Any] = {"user_id": user_id}
    if not document_ids:
        return user_clause
    return {
        "$and": [
            user_clause,
            {"document_id": {"$in": list(document_ids)}},
        ]
    }


def _parse_results(result: dict[str, Any]) -> list[VectorMatch]:
    """Ham ChromaDB query çıktısını `VectorMatch` listesine çevirir."""
    ids = (result.get("ids") or [[]])[0]
    documents = (result.get("documents") or [[]])[0]
    metadatas = (result.get("metadatas") or [[]])[0]
    distances = (result.get("distances") or [[]])[0]

    matches: list[VectorMatch] = []
    for vector_id, text, metadata, distance in zip(
        ids, documents, metadatas, distances
    ):
        metadata = metadata or {}
        page = metadata.get("page")
        matches.append(
            VectorMatch(
                vector_id=vector_id,
                text=text or "",
                # Kosinüs mesafesini benzerlik skoruna çevir (1.0 = en benzer).
                score=round(1.0 - float(distance), 4),
                document_id=int(metadata.get("document_id", 0)),
                chunk_index=int(metadata.get("chunk_index", 0)),
                page_number=None if page in (None, -1) else int(page),
            )
        )
    return matches
