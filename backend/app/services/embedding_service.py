"""Embedding servisi (Hafta 3).

Doküman chunk'larını ve kullanıcı sorularını anlamsal arama için yoğun
(dense) vektörlere dönüştürür. Model `.env` içindeki `EMBEDDING_MODEL`
değerinden okunur (varsayılan: çok dilli `paraphrase-multilingual-MiniLM-L12-v2`,
Türkçe içerikte makul sonuç verir ve 384 boyutlu vektör üretir).

Model ilk kullanımda tembel (lazy) yüklenir ve süreç boyunca tek bir örnek
(singleton) olarak yeniden kullanılır; böylece her istekte tekrar yüklenmez.
sentence-transformers ilk çağrıda modeli indirip diske önbelleğe alır.

Doküman ve sorgu vektörleri tutarlı olması için aynı model ve aynı normalize
ayarıyla üretilir. Vektörler L2-normalize edilir; bu sayede ChromaDB'deki
kosinüs benzerliği güvenilir kalır.
"""

from __future__ import annotations

import logging
import threading
from functools import lru_cache
from typing import TYPE_CHECKING

from app.config import settings

if TYPE_CHECKING:  # pragma: no cover - yalnızca tip denetimi için
    from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

# Model yüklenmesini eş zamanlı isteklere karşı korur (tek seferde yüklenir).
_model_lock = threading.Lock()


class EmbeddingError(Exception):
    """Embedding üretimi veya model yüklemesi sırasında oluşan hata."""


@lru_cache(maxsize=1)
def _load_model() -> "SentenceTransformer":
    """Embedding modelini (tembel) yükler ve önbelleğe alır.

    İlk çağrı modeli indirip belleğe yükler; sonraki çağrılar aynı örneği
    döner. Model yüklenemezse `EmbeddingError` fırlatılır.
    """
    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:  # pragma: no cover - bağımlılık eksikse
        raise EmbeddingError(
            "Embedding için sentence-transformers kurulu değil."
        ) from exc

    try:
        logger.info("Embedding modeli yükleniyor: %s", settings.EMBEDDING_MODEL)
        model = SentenceTransformer(settings.EMBEDDING_MODEL)
        logger.info("Embedding modeli hazır (boyut=%s).", _model_dimension(model))
        return model
    except Exception as exc:
        raise EmbeddingError(
            "Embedding modeli yüklenemedi. Lütfen tekrar deneyin."
        ) from exc


def _model_dimension(model: "SentenceTransformer") -> int:
    """Modelin vektör boyutunu sürümden bağımsız döner.

    sentence-transformers 5.x'te `get_sentence_embedding_dimension`,
    `get_embedding_dimension` olarak yeniden adlandırıldı; her iki ad da
    desteklenir.
    """
    getter = getattr(model, "get_embedding_dimension", None) or getattr(
        model, "get_sentence_embedding_dimension"
    )
    return int(getter())


def get_model() -> "SentenceTransformer":
    """Model singleton'ını döner (gerekirse yükler). Thread-safe."""
    with _model_lock:
        return _load_model()


def get_embedding_dimension() -> int:
    """Aktif embedding modelinin vektör boyutunu döner."""
    return _model_dimension(get_model())


def embed_texts(texts: list[str]) -> list[list[float]]:
    """Metin listesi için embedding vektörleri üretir (toplu/batch).

    Boş liste verilirse boş liste döner. Vektörler L2-normalize edilir.
    """
    if not texts:
        return []

    model = get_model()
    try:
        vectors = model.encode(
            texts,
            normalize_embeddings=True,
            convert_to_numpy=True,
            show_progress_bar=False,
        )
    except Exception as exc:
        raise EmbeddingError(
            "Embedding üretilirken bir hata oluştu."
        ) from exc

    return [vector.tolist() for vector in vectors]


def embed_query(text: str) -> list[float]:
    """Tek bir sorgu/metin için embedding vektörü üretir."""
    vectors = embed_texts([text])
    if not vectors:
        raise EmbeddingError("Boş sorgu için embedding üretilemez.")
    return vectors[0]
