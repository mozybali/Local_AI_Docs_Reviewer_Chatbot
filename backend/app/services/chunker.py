"""Chunking servisi.

Çıkarılan metni, embedding ve retrieval için uygun büyüklükte parçalara
(chunk) böler. Varsayılan olarak `CHUNK_SIZE=512` token ve `CHUNK_OVERLAP=50`
token kullanılır (`.env`'den okunur).

Token yaklaşımı: Hafta 2'de gerçek bir model tokenizer'ı yerine, basit ve
bağımsız olması için "kelime" (whitespace ile ayrılmış parça) bir token vekili
olarak kullanılır. Embedding modelinin gerçek tokenizer'ı Hafta 3'te
devreye girdiğinde bu fonksiyona `tokenizer` parametresiyle aktarılabilir.

Sayfa bilgisini korumak için chunking her sayfa için ayrı ayrı yapılır; böylece
her chunk net bir `page_number` değerine sahip olur ve kaynak gösterimi
doğru kalır. `chunk_index` tüm doküman boyunca artan global bir sıradır.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Iterable

from app.config import settings
from app.services.text_extractor import ExtractedPage

# Ardışık boşlukları tek boşluğa indirger; kelime (token vekili) ayırıcı.
_WHITESPACE = re.compile(r"\s+")


@dataclass(frozen=True)
class Chunk:
    """Tek bir doküman parçası (chunk)."""

    chunk_index: int
    page_number: int | None
    text: str


def _tokenize(text: str) -> list[str]:
    """Metni token vekili olan kelimelere böler (boşlukları atar)."""
    return [token for token in _WHITESPACE.split(text.strip()) if token]


def _chunk_tokens(tokens: list[str], chunk_size: int, overlap: int) -> list[str]:
    """Token listesini sliding window ile chunk metinlerine böler."""
    if not tokens:
        return []

    # Geçersiz parametrelere karşı savunma: adım en az 1 olmalı.
    step = chunk_size - overlap
    if step < 1:
        step = chunk_size if chunk_size > 0 else 1

    chunks: list[str] = []
    start = 0
    total = len(tokens)
    while start < total:
        window = tokens[start : start + chunk_size]
        chunks.append(" ".join(window))
        if start + chunk_size >= total:
            break
        start += step
    return chunks


def chunk_pages(
    pages: Iterable[ExtractedPage],
    chunk_size: int | None = None,
    overlap: int | None = None,
) -> list[Chunk]:
    """Sayfaları sırayla chunk'lara böler.

    Her chunk kaynak sayfasının numarasını taşır; `chunk_index` tüm doküman
    boyunca 0'dan başlayarak artar. Boş sayfalar atlanır.
    """
    size = chunk_size if chunk_size is not None else settings.CHUNK_SIZE
    over = overlap if overlap is not None else settings.CHUNK_OVERLAP

    result: list[Chunk] = []
    index = 0
    for page in pages:
        tokens = _tokenize(page.text)
        for text in _chunk_tokens(tokens, size, over):
            result.append(
                Chunk(chunk_index=index, page_number=page.page_number, text=text)
            )
            index += 1
    return result


def chunk_text(
    text: str,
    chunk_size: int | None = None,
    overlap: int | None = None,
) -> list[Chunk]:
    """Tek bir metni (sayfa bilgisi olmadan) chunk'lara böler.

    Test ve sayfa bilgisi gerektirmeyen durumlar için yardımcıdır.
    """
    return chunk_pages(
        [ExtractedPage(page_number=1, text=text)],
        chunk_size=chunk_size,
        overlap=overlap,
    )
