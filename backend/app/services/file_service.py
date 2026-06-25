"""Dosya kaydetme servisi.

Yüklenen dosyalar güvenli bir şekilde `uploads/` klasörüne yazılır:
- Dosya adı sanitize edilir.
- Diskte çakışmayı ve path traversal'ı önlemek için benzersiz (UUID tabanlı)
  bir dosya adı üretilir.
- Hedef yolun her zaman `uploads/` içinde kaldığı doğrulanır.
"""

from __future__ import annotations

import re
import unicodedata
import uuid
from dataclasses import dataclass
from pathlib import Path

from app.config import settings

# backend/ kök dizini: app/services/file_service.py -> parents[2] == backend/
BASE_DIR = Path(__file__).resolve().parents[2]

_upload_path = Path(settings.UPLOAD_DIR)
UPLOAD_PATH = _upload_path if _upload_path.is_absolute() else BASE_DIR / _upload_path

_SAFE_CHARS = re.compile(r"[^A-Za-z0-9._-]+")


@dataclass(frozen=True)
class SavedFile:
    """Diske kaydedilen dosyanın bilgileri."""

    stored_filename: str  # diskte tutulan benzersiz ad
    original_filename: str  # kullanıcının yüklediği (sanitize edilmiş) ad
    file_path: str  # diskteki tam yol


def ensure_upload_dir() -> None:
    """`uploads/` klasörünün var olduğundan emin olur."""
    UPLOAD_PATH.mkdir(parents=True, exist_ok=True)


def sanitize_filename(filename: str) -> str:
    """Dosya adını güvenli hale getirir.

    Dizin bileşenlerini atar, Türkçe karakterleri ASCII'ye indirger ve
    yalnızca harf/rakam/`._-` karakterlerine izin verir.
    """
    # Yalnızca dosya adını al (path traversal bileşenlerini at).
    name = Path(filename).name
    # Unicode -> ASCII (ör. "ç" -> "c").
    name = (
        unicodedata.normalize("NFKD", name)
        .encode("ascii", "ignore")
        .decode("ascii")
    )
    name = _SAFE_CHARS.sub("_", name).strip("._")
    return name or "dosya"


def save_upload(content: bytes, original_filename: str, ext: str) -> SavedFile:
    """Doğrulanmış dosya içeriğini diske yazar ve bilgilerini döner."""
    ensure_upload_dir()

    safe_original = sanitize_filename(original_filename)
    stored_filename = f"{uuid.uuid4().hex}.{ext}"
    target = (UPLOAD_PATH / stored_filename).resolve()

    # Defansif kontrol: hedef her zaman uploads/ içinde olmalı.
    if UPLOAD_PATH.resolve() not in target.parents:
        raise ValueError("Geçersiz dosya yolu.")

    target.write_bytes(content)

    return SavedFile(
        stored_filename=stored_filename,
        original_filename=safe_original,
        file_path=str(target),
    )


def delete_file(file_path: str) -> bool:
    """`uploads/` içindeki bir dosyayı güvenli şekilde siler.

    Yol her zaman `uploads/` altında olmalıdır (path traversal'a karşı). Dosya
    zaten yoksa sessizce `False` döner; silinirse `True` döner.
    """
    if not file_path:
        return False

    target = Path(file_path).resolve()
    upload_root = UPLOAD_PATH.resolve()
    if upload_root != target and upload_root not in target.parents:
        raise ValueError("Geçersiz dosya yolu.")

    try:
        target.unlink()
        return True
    except FileNotFoundError:
        return False
