"""Chunking servisi.

Çıkarılan metni, embedding ve retrieval için uygun büyüklükte parçalara
(chunk) böler. Varsayılan olarak `CHUNK_SIZE=512` / `CHUNK_OVERLAP=50` token
kullanılır (`.env`'den okunur).

Token ölçümü: `token_counter` verilirse (embedding modelinin gerçek
tokenizer'ı, bkz. `embedding_service.try_get_token_counter`) chunk boyutu
gerçek model tokenlarıyla ölçülür ve `max_tokens` (modelin girdi limiti,
`max_seq_length`) ile sınırlanır. Böylece chunk'lar embedding sırasında asla
sessizce kırpılmaz. `token_counter` yoksa kelime (whitespace) vekili kullanılır
(eski davranış; testler ve model gerektirmeyen yollar için).

Bölme stratejisi: sayfa metni önce cümlelere ayrılır; cümleler bütçeyi aşmadan
açgözlü (greedy) şekilde paketlenir. Tek başına bütçeyi aşan cümleler kelime
bazlı pencerelerle bölünür. Chunk'lar arası süreklilik için önceki chunk'ın
sonundaki cümleler `overlap` bütçesi kadar bir sonraki chunk'a taşınır.

Sayfa bilgisini korumak için chunking her sayfa için ayrı ayrı yapılır; böylece
her chunk net bir `page_number` değerine sahip olur ve kaynak gösterimi doğru
kalır. `chunk_index` tüm doküman boyunca artan global bir sıradır. Çok kısa
chunk'lar (`CHUNK_MIN_WORDS` altı; sayfa numarası artefaktı gibi gürültü)
embedding'e alınmaz.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Callable, Iterable

from app.config import settings
from app.services.text_extractor import ExtractedPage

# Ardışık boşlukları tek boşluğa indirger; kelime (token vekili) ayırıcı.
_WHITESPACE = re.compile(r"\s+")

# Cümle sonu: nokta/soru/ünlem/elipsis sonrası boşluk. Kısaltmalarda fazladan
# bölme olabilir; cümleler yeniden paketlendiği için zararsızdır.
_SENTENCE_END = re.compile(r"(?<=[.!?…])\s+")

TokenCounter = Callable[[str], int]


@dataclass(frozen=True)
class Chunk:
    """Tek bir doküman parçası (chunk)."""

    chunk_index: int
    page_number: int | None
    text: str


def _tokenize(text: str) -> list[str]:
    """Metni token vekili olan kelimelere böler (boşlukları atar)."""
    return [token for token in _WHITESPACE.split(text.strip()) if token]


def _token_len(text: str, token_counter: TokenCounter | None) -> int:
    """Metnin token uzunluğunu ölçer (tokenizer varsa gerçek, yoksa kelime)."""
    if token_counter is not None:
        return token_counter(text)
    return len(_tokenize(text))


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


def _split_long_text(
    text: str,
    size: int,
    overlap: int,
    token_counter: TokenCounter | None,
) -> list[str]:
    """Bütçeyi tek başına aşan bir metni kelime pencereleriyle böler.

    `token_counter` yoksa doğrudan kelime penceresi kullanılır (eski davranış).
    Varsa, metnin ortalama token/kelime oranıyla pencere genişliği kelimeye
    çevrilir; ufak sapmalar kabul edilir (bkz. modül docstring'i) ve güvenlik
    için pencere %10 küçük tutulur.
    """
    words = _tokenize(text)
    if token_counter is None:
        return _chunk_tokens(words, size, overlap)

    total_tokens = token_counter(text)
    if not words or total_tokens <= 0:
        return []
    ratio = max(1.0, total_tokens / len(words))
    words_per_chunk = max(1, int(size / ratio * 0.9))
    overlap_words = max(0, int(overlap / ratio))
    return _chunk_tokens(words, words_per_chunk, overlap_words)


def _split_sentences(text: str) -> list[str]:
    """Metni cümle (yaklaşık) parçalarına ayırır; boş parçaları atar."""
    return [s.strip() for s in _SENTENCE_END.split(text.strip()) if s.strip()]


def _pack_pieces(
    pieces: list[tuple[str, int]], size: int, overlap: int
) -> list[str]:
    """(metin, token_uzunluğu) parçalarını bütçeye göre açgözlü paketler.

    Chunk sınırında, önceki chunk'ın sonundaki parçalar toplamı `overlap`
    bütçesini aşmayacak şekilde bir sonraki chunk'ın başına taşınır. Taşınan
    parçalar yeni parçayla birlikte bütçeyi aşarsa overlap bu sınır için atlanır
    (chunk boyutu asla `size` üzerine çıkarılmaz).
    """
    # overlap >= size sonsuz büyümeye yol açar; eski davranışla uyumlu şekilde
    # overlap fiilen sıfırlanır.
    effective_overlap = overlap if 0 <= overlap < size else 0

    chunks: list[str] = []
    current: list[tuple[str, int]] = []
    current_len = 0

    for piece, piece_len in pieces:
        if current and current_len + piece_len > size:
            chunks.append(" ".join(p for p, _ in current))
            # Overlap: sondan geriye, bütçeye sığan parçaları taşı.
            kept: list[tuple[str, int]] = []
            kept_len = 0
            for prev_piece, prev_len in reversed(current):
                if kept_len + prev_len > effective_overlap:
                    break
                kept.insert(0, (prev_piece, prev_len))
                kept_len += prev_len
            if kept_len + piece_len > size:
                kept, kept_len = [], 0
            current = kept
            current_len = kept_len
        current.append((piece, piece_len))
        current_len += piece_len

    if current:
        chunks.append(" ".join(p for p, _ in current))
    return chunks


def _chunk_page_text(
    text: str,
    size: int,
    overlap: int,
    token_counter: TokenCounter | None,
) -> list[str]:
    """Tek bir sayfanın metnini cümle sınırlarına saygılı chunk'lara böler."""
    sentences = _split_sentences(text)
    if not sentences:
        return []

    pieces: list[tuple[str, int]] = []
    for sentence in sentences:
        sentence_len = _token_len(sentence, token_counter)
        if sentence_len > size:
            for part in _split_long_text(sentence, size, overlap, token_counter):
                pieces.append((part, _token_len(part, token_counter)))
        else:
            pieces.append((sentence, sentence_len))

    return _pack_pieces(pieces, size, overlap)


def chunk_pages(
    pages: Iterable[ExtractedPage],
    chunk_size: int | None = None,
    overlap: int | None = None,
    token_counter: TokenCounter | None = None,
    max_tokens: int | None = None,
) -> list[Chunk]:
    """Sayfaları sırayla chunk'lara böler.

    Her chunk kaynak sayfasının numarasını taşır; `chunk_index` tüm doküman
    boyunca 0'dan başlayarak artar. Boş sayfalar ve `CHUNK_MIN_WORDS` altındaki
    gürültü parçaları atlanır.

    - `token_counter`: embedding modelinin tokenizer'ına dayalı ölçüm
      (verilmezse kelime vekili kullanılır).
    - `max_tokens`: modelin girdi limiti (`max_seq_length`); efektif chunk
      boyutu bu değeri asla aşmaz (embedding'de sessiz kırpılma önlenir).
    """
    size = chunk_size if chunk_size is not None else settings.CHUNK_SIZE
    over = overlap if overlap is not None else settings.CHUNK_OVERLAP

    if max_tokens is not None and max_tokens > 0:
        size = min(size, max_tokens)
    if size < 1:
        size = 1

    min_words = max(0, settings.CHUNK_MIN_WORDS)

    result: list[Chunk] = []
    index = 0
    for page in pages:
        for text in _chunk_page_text(page.text, size, over, token_counter):
            if len(_tokenize(text)) < min_words:
                continue
            result.append(
                Chunk(chunk_index=index, page_number=page.page_number, text=text)
            )
            index += 1
    return result


def chunk_text(
    text: str,
    chunk_size: int | None = None,
    overlap: int | None = None,
    token_counter: TokenCounter | None = None,
    max_tokens: int | None = None,
) -> list[Chunk]:
    """Tek bir metni (sayfa bilgisi olmadan) chunk'lara böler.

    Test ve sayfa bilgisi gerektirmeyen durumlar için yardımcıdır.
    """
    return chunk_pages(
        [ExtractedPage(page_number=1, text=text)],
        chunk_size=chunk_size,
        overlap=overlap,
        token_counter=token_counter,
        max_tokens=max_tokens,
    )
