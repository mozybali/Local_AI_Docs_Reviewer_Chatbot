"""Yüklenen dosyalar için güvenlik ve doğrulama kontrolleri.

Kontroller:
- Uzantı (yalnızca izin verilen tipler)
- İçerik tipi / MIME (magic byte imzaları ile)
- Maksimum dosya boyutu
- Boş dosya reddi

Doğrulama başarısız olursa `FileValidationError` fırlatılır; router bunu uygun
HTTP durum koduna çevirir.
"""

from __future__ import annotations

from app.config import settings


class FileValidationError(Exception):
    """Dosya doğrulama hatası. `status_code` ile HTTP koduna eşlenir."""

    def __init__(self, detail: str, status_code: int = 400) -> None:
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


# Uzantı -> beklenen magic byte imzaları
_MAGIC_SIGNATURES: dict[str, tuple[bytes, ...]] = {
    "pdf": (b"%PDF",),
    "docx": (b"PK\x03\x04",),  # docx aslında bir zip arşividir
}


def get_extension(filename: str) -> str:
    """Dosya adından küçük harfli, noktasız uzantıyı döner."""
    _, _, ext = (filename or "").rpartition(".")
    return ext.strip().lower()


def _looks_like_text(content: bytes) -> bool:
    """İçeriğin metin (TXT) olup olmadığını basitçe kontrol eder.

    İkili (binary) dosyaların .txt uzantısıyla yüklenmesini engellemek için
    NUL byte içeren içerikler reddedilir.
    """
    sample = content[:8192]
    if b"\x00" in sample:
        return False
    try:
        sample.decode("utf-8")
    except UnicodeDecodeError:
        # UTF-8 değilse Latin-1 gibi tek-byte kodlamalara izin ver.
        pass
    return True


def validate_upload(filename: str, content: bytes) -> str:
    """Yüklenen dosyayı doğrular ve normalize edilmiş uzantıyı döner.

    Hata durumunda `FileValidationError` fırlatır.
    """
    ext = get_extension(filename)

    # 1) Uzantı kontrolü
    if not ext or ext not in settings.allowed_extensions_set:
        allowed = ", ".join(sorted(settings.allowed_extensions_set)).upper()
        raise FileValidationError(
            f"Yalnızca {allowed} dosyaları desteklenmektedir.",
            status_code=415,
        )

    # 2) Boş dosya kontrolü
    if not content:
        raise FileValidationError(
            "Yüklenen dosya boş görünüyor.",
            status_code=400,
        )

    # 3) Boyut kontrolü
    if len(content) > settings.max_file_size_bytes:
        raise FileValidationError(
            f"Maksimum dosya boyutu {settings.MAX_FILE_SIZE_MB} MB'tır.",
            status_code=413,
        )

    # 4) MIME / içerik imzası kontrolü
    if ext in _MAGIC_SIGNATURES:
        if not any(content.startswith(sig) for sig in _MAGIC_SIGNATURES[ext]):
            raise FileValidationError(
                "Dosya içeriği uzantısıyla uyuşmuyor. Dosya bozuk olabilir.",
                status_code=415,
            )
    elif ext == "txt":
        if not _looks_like_text(content):
            raise FileValidationError(
                "Dosya içeriği geçerli bir metin dosyası gibi görünmüyor.",
                status_code=415,
            )

    return ext
