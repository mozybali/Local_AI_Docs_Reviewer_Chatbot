"""Yüklenen dosyalar için güvenlik ve doğrulama kontrolleri.

Kontroller:
- Uzantı (yalnızca izin verilen tipler)
- İçerik tipi / MIME (magic byte imzaları ile)
- Maksimum dosya boyutu (okuma sırasında, tamamı belleğe alınmadan)
- Boş dosya reddi
- DOCX (zip) yapısal sınırları: zip bomb, aşırı girdi sayısı, path traversal

Doğrulama başarısız olursa `FileValidationError` fırlatılır; router bunu uygun
HTTP durum koduna çevirir.
"""

from __future__ import annotations

import io
import zipfile
from typing import BinaryIO

from app.config import settings

# Boyut sınırlı okuma için parça boyutu.
_READ_CHUNK_SIZE = 1024 * 1024  # 1 MB

# DOCX (zip) yapısal sınırları: normal bir DOCX birkaç yüz girdi ve toplamda
# birkaç MB açılmış içerik taşır. Bu sınırlar zip bomb / kaynak tüketimi
# saldırılarına karşı geniş ama güvenli tutulmuştur.
_DOCX_MAX_ENTRIES = 2048
_DOCX_MAX_UNCOMPRESSED_BYTES = 250 * 1024 * 1024  # 250 MB


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
    "png": (b"\x89PNG\r\n\x1a\n",),
    "jpg": (b"\xff\xd8\xff",),
    "jpeg": (b"\xff\xd8\xff",),
}


def get_extension(filename: str) -> str:
    """Dosya adından küçük harfli, noktasız uzantıyı döner."""
    _, _, ext = (filename or "").rpartition(".")
    return ext.strip().lower()


def read_upload_limited(stream: BinaryIO) -> bytes:
    """Upload içeriğini boyut sınırını aşmadan parça parça okur.

    İçeriğin tamamını okuduktan SONRA boyut kontrolü yapmak, çok büyük bir
    istekle belleğin doldurulmasına (DoS) izin verir. Bu yardımcı, sınır
    aşıldığı anda okumayı keser ve `413` ile reddeder.
    """
    max_bytes = settings.max_file_size_bytes
    chunks: list[bytes] = []
    total = 0
    while True:
        chunk = stream.read(_READ_CHUNK_SIZE)
        if not chunk:
            break
        total += len(chunk)
        if total > max_bytes:
            raise FileValidationError(
                f"Maksimum dosya boyutu {settings.MAX_FILE_SIZE_MB} MB'tır.",
                status_code=413,
            )
        chunks.append(chunk)
    return b"".join(chunks)


def _validate_docx_zip(content: bytes) -> None:
    """DOCX (zip) yapısını kaynak tüketimi saldırılarına karşı denetler.

    - Geçerli bir zip olmalı (PK imzası tek başına yeterli değildir).
    - Girdi sayısı ve toplam açılmış boyut sınırlı olmalı (zip bomb önlemi).
    - Girdi adları mutlak yol veya `..` içermemeli (zip path traversal).
    """
    try:
        with zipfile.ZipFile(io.BytesIO(content)) as archive:
            infos = archive.infolist()
    except zipfile.BadZipFile:
        raise FileValidationError(
            "Dosya içeriği geçerli bir DOCX (zip) arşivi değil.",
            status_code=415,
        )

    if len(infos) > _DOCX_MAX_ENTRIES:
        raise FileValidationError(
            "DOCX arşivi çok fazla dosya içeriyor.",
            status_code=415,
        )

    total_uncompressed = 0
    for info in infos:
        name = info.filename.replace("\\", "/")
        if name.startswith("/") or ".." in name.split("/"):
            raise FileValidationError(
                "DOCX arşivi güvenli olmayan dosya yolları içeriyor.",
                status_code=415,
            )
        total_uncompressed += info.file_size
        if total_uncompressed > _DOCX_MAX_UNCOMPRESSED_BYTES:
            raise FileValidationError(
                "DOCX arşivinin açılmış boyutu izin verilen sınırı aşıyor.",
                status_code=415,
            )


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
        # 4b) DOCX için zip yapısal denetimi (zip bomb / traversal önlemi).
        if ext == "docx":
            _validate_docx_zip(content)
    elif ext == "txt":
        if not _looks_like_text(content):
            raise FileValidationError(
                "Dosya içeriği geçerli bir metin dosyası gibi görünmüyor.",
                status_code=415,
            )

    return ext
