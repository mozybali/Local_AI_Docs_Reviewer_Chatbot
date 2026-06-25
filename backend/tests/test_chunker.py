"""Chunking servisi birim testleri.

Token vekili olarak kelimeler (whitespace) kullanıldığı için testler de kelime
sayısı üzerinden chunk boyutu ve overlap davranışını doğrular.
"""

from app.services.chunker import chunk_pages, chunk_text
from app.services.text_extractor import ExtractedPage


def test_short_text_single_chunk():
    text = "bir iki üç dört beş"
    chunks = chunk_text(text, chunk_size=512, overlap=50)
    assert len(chunks) == 1
    assert chunks[0].chunk_index == 0
    assert chunks[0].page_number == 1
    assert chunks[0].text == text


def test_chunk_size_and_overlap():
    # 25 token; chunk_size=10, overlap=2 -> adım=8 -> başlangıçlar 0, 8, 16
    # (16. başlangıç token 16-24'ü kapsadığından 4. chunk oluşmaz).
    tokens = [f"t{i}" for i in range(25)]
    chunks = chunk_text(" ".join(tokens), chunk_size=10, overlap=2)

    assert [c.chunk_index for c in chunks] == [0, 1, 2]
    # İlk chunk tam 10 token.
    assert chunks[0].text.split() == tokens[0:10]
    # Overlap: ikinci chunk 8. token'dan başlar (10 - 2).
    assert chunks[1].text.split()[0] == "t8"
    # Son chunk kalan token'ları (16-24) içerir, boş değildir.
    assert chunks[-1].text.split() == tokens[16:25]


def test_overlap_creates_shared_tokens():
    tokens = [f"w{i}" for i in range(20)]
    chunks = chunk_text(" ".join(tokens), chunk_size=10, overlap=3)
    first = chunks[0].text.split()
    second = chunks[1].text.split()
    # Son 3 token ilk chunk ile ikinci chunk'ta paylaşılmalı.
    assert first[-3:] == second[:3]


def test_pages_preserve_page_numbers_and_global_index():
    pages = [
        ExtractedPage(page_number=1, text=" ".join(f"a{i}" for i in range(5))),
        ExtractedPage(page_number=2, text=" ".join(f"b{i}" for i in range(5))),
    ]
    chunks = chunk_pages(pages, chunk_size=10, overlap=2)
    assert len(chunks) == 2
    assert chunks[0].page_number == 1
    assert chunks[1].page_number == 2
    # Global index sayfalar arasında artar.
    assert [c.chunk_index for c in chunks] == [0, 1]


def test_empty_and_whitespace_pages_skipped():
    pages = [
        ExtractedPage(page_number=1, text="   \n  "),
        ExtractedPage(page_number=2, text=""),
    ]
    assert chunk_pages(pages, chunk_size=10, overlap=2) == []


def test_overlap_ge_chunk_size_does_not_loop_forever():
    # Hatalı parametre: overlap >= chunk_size; sonsuz döngüye girmemeli.
    tokens = [f"x{i}" for i in range(30)]
    chunks = chunk_text(" ".join(tokens), chunk_size=10, overlap=10)
    assert len(chunks) >= 1
    # Tüm token'lar kapsanmalı (adım chunk_size'a düşürülür).
    assert chunks[0].text.split() == tokens[0:10]
