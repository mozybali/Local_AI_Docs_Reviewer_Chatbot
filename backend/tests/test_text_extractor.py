"""Metin çıkarma sanitizasyon testleri (Hafta 2/4).

Bazı PDF'ler glifleri NUL (0x00) baytına eşler; bu metin PostgreSQL'e yazılırken
`DataError` verir. `extract_pages` çıkışta NUL ve diğer kontrol karakterlerini
temizlemeli. Burada TXT yolu üzerinden (harici bağımlılık gerektirmeden) ve
yardımcı fonksiyon düzeyinde doğrulanır.
"""

from app.services.text_extractor import _sanitize_text, extract_pages


def test_sanitize_removes_nul_and_control_chars():
    # NUL ve diğer C0 kontrol karakterleri kaldırılır; harf/boşluk korunur.
    dirty = "Ün\x00vers\x00tes\x00\x07 \tsatır\nsonu\r"
    clean = _sanitize_text(dirty)
    assert "\x00" not in clean
    assert "\x07" not in clean
    assert clean.startswith("Ünverstes")  # NUL'lar düştü
    # Yaygın boşluklar (tab, newline, carriage return) korunur.
    assert "\t" in clean and "\n" in clean and "\r" in clean


def test_sanitize_handles_empty():
    assert _sanitize_text("") == ""


def test_extract_txt_strips_nul_bytes(tmp_path):
    # PDF'teki NUL-glif durumunu TXT üzerinden taklit et: çıkış NUL içermemeli.
    f = tmp_path / "belge.txt"
    f.write_bytes("Ün\x00vers\x00te metni".encode("utf-8"))

    pages = extract_pages(str(f), "txt")
    assert len(pages) == 1
    assert "\x00" not in pages[0].text
    assert pages[0].text == "Ünverste metni"
