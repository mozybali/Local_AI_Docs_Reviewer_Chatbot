"""Metin çıkarma servisi (PDF, TXT ve DOCX).

Sayfa numarası bilgisini koruyacak şekilde, doküman içeriğini sayfa sayfa
çıkarır. Bu sayede chunk'lara sayfa numarası eklenebilir.

PDF için önce `pdfplumber`, başarısız olursa `pypdf` denenir. Şifreli veya bozuk
PDF'ler `TextExtractionError` ile işaretlenir.

DOCX (python-docx) dosyalarında güvenilir bir sayfa kavramı bulunmadığı için
tüm metin tek sayfa (`page_number=1`) olarak çıkarılır.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


class TextExtractionError(Exception):
    """Metin çıkarma sırasında oluşan hata."""


# PostgreSQL `text`/`varchar` alanları NUL (0x00) baytını saklayamaz. Bazı
# PDF'ler (ör. e-imzalı Resmî Gazete belgeleri) bazı glifleri 0x00'a eşler; bu
# da chunk_text PG'ye yazılırken `DataError`'a yol açar. Bu yüzden NUL'u ve diğer
# C0 kontrol karakterlerini (yaygın boşluklar \t \n \r hariç) çıkarımda temizle.
# DEL (0x7F) de güvenlik için kaldırılır.
_CONTROL_CHARS_TABLE = {
    codepoint: None
    for codepoint in (*range(0x20), 0x7F)
    if codepoint not in (0x09, 0x0A, 0x0D)
}


def _sanitize_text(text: str) -> str:
    """Saklanamayan kontrol karakterlerini (NUL dahil) metinden temizler."""
    if not text:
        return text
    return text.translate(_CONTROL_CHARS_TABLE)


@dataclass(frozen=True)
class ExtractedPage:
    """Tek bir sayfanın çıkarılmış metni."""

    page_number: int
    text: str


def extract_pages(file_path: str, file_type: str) -> list[ExtractedPage]:
    """Dosya tipine göre metni sayfa sayfa çıkarır.

    Desteklenmeyen tip için `TextExtractionError` fırlatır.
    """
    ext = file_type.strip().lower().lstrip(".")
    if ext == "pdf":
        pages = _extract_pdf(file_path)
    elif ext == "txt":
        pages = _extract_txt(file_path)
    elif ext == "docx":
        pages = _extract_docx(file_path)
    else:
        raise TextExtractionError(f"Desteklenmeyen dosya tipi: {ext}")

    # Tüm çıkarıcılar için tek noktada sanitizasyon: PG'nin reddettiği NUL ve
    # diğer kontrol karakterlerini temizle (yoksa commit DataError verir).
    return [
        ExtractedPage(page_number=p.page_number, text=_sanitize_text(p.text))
        for p in pages
    ]


def extract_text(file_path: str, file_type: str) -> str:
    """Tüm sayfaları birleştirip tek bir metin döner."""
    pages = extract_pages(file_path, file_type)
    return "\n\n".join(page.text for page in pages if page.text).strip()


def _extract_txt(file_path: str) -> list[ExtractedPage]:
    """TXT dosyasını okur. UTF-8 başarısız olursa Latin-1'e düşer."""
    raw = Path(file_path).read_bytes()
    try:
        text = raw.decode("utf-8")
    except UnicodeDecodeError:
        text = raw.decode("latin-1", errors="replace")
    return [ExtractedPage(page_number=1, text=text.strip())]


def _extract_docx(file_path: str) -> list[ExtractedPage]:
    """DOCX dosyasından metni çıkarır.

    python-docx sayfa sınırlarını vermediği için tüm paragraflar tek bir
    sayfa olarak birleştirilir. Bozuk/desteklenmeyen dosyalar
    `TextExtractionError` ile işaretlenir.
    """
    try:
        import docx  # python-docx
    except ImportError:  # pragma: no cover - bağımlılık eksikse
        raise TextExtractionError(
            "DOCX desteği için python-docx kurulu değil."
        )

    try:
        document = docx.Document(file_path)
    except Exception:
        raise TextExtractionError(
            "Bu DOCX dosyası okunamadı. Bozuk olabilir."
        )

    paragraphs = [p.text for p in document.paragraphs if p.text and p.text.strip()]
    text = "\n".join(paragraphs).strip()
    return [ExtractedPage(page_number=1, text=text)]


def _extract_pdf(file_path: str) -> list[ExtractedPage]:
    """PDF metnini sayfa sayfa çıkarır (pdfplumber, fallback pypdf)."""
    pages = _extract_pdf_with_pdfplumber(file_path)
    if pages is None:
        pages = _extract_pdf_with_pypdf(file_path)

    if pages is None:
        raise TextExtractionError(
            "Bu PDF okunamadı. Şifreli veya bozuk olabilir."
        )
    return pages


def _extract_pdf_with_pdfplumber(file_path: str) -> list[ExtractedPage] | None:
    """pdfplumber ile dener; başarısız olursa None döner."""
    try:
        import pdfplumber
    except ImportError:
        return None

    try:
        pages: list[ExtractedPage] = []
        with pdfplumber.open(file_path) as pdf:
            for index, page in enumerate(pdf.pages, start=1):
                text = page.extract_text() or ""
                pages.append(ExtractedPage(page_number=index, text=text.strip()))
                # pdfplumber sayfa nesneleri layout cache'i biriktirir; büyük
                # PDF'lerde bellek sayfa sayısıyla büyür. Metni aldıktan sonra
                # cache bırakılır (sayfa başına sabit bellek).
                page.flush_cache()
        return pages
    except Exception:
        return None


def _extract_pdf_with_pypdf(file_path: str) -> list[ExtractedPage] | None:
    """pypdf ile dener; başarısız olursa None döner."""
    try:
        from pypdf import PdfReader
    except ImportError:
        return None

    try:
        reader = PdfReader(file_path)
        if reader.is_encrypted:
            # Boş şifre ile açmayı dene; olmuyorsa başarısız say.
            try:
                reader.decrypt("")
            except Exception:
                return None
        pages: list[ExtractedPage] = []
        for index, page in enumerate(reader.pages, start=1):
            text = page.extract_text() or ""
            pages.append(ExtractedPage(page_number=index, text=text.strip()))
        return pages
    except Exception:
        return None
