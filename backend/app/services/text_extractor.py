"""Metin çıkarma servisi (PDF ve TXT).

Sayfa numarası bilgisini koruyacak şekilde, doküman içeriğini sayfa sayfa
çıkarır. Bu sayede ileride (Hafta 2-3) chunk'lara sayfa numarası eklenebilir.

PDF için önce `pdfplumber`, başarısız olursa `pypdf` denenir. Şifreli veya bozuk
PDF'ler `TextExtractionError` ile işaretlenir.
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


class TextExtractionError(Exception):
    """Metin çıkarma sırasında oluşan hata."""


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
        return _extract_pdf(file_path)
    if ext == "txt":
        return _extract_txt(file_path)
    # DOCX desteği Hafta 2'de eklenecek.
    raise TextExtractionError(f"Desteklenmeyen dosya tipi: {ext}")


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
