"""Dosya doğrulama ve dosya servisi güvenlik testleri.

Kapsam:
- `validate_upload`: uzantı, boş dosya, boyut, magic byte, binary TXT.
- `read_upload_limited`: içerik tamamen belleğe alınmadan boyut sınırı (413).
- DOCX zip sertleştirmesi: bozuk zip, zip bomb, aşırı girdi, path traversal.
- `sanitize_filename`: path traversal bileşenleri ve güvensiz karakterler.
- `save_upload`: diskte UUID tabanlı ad.
- `delete_file`: uploads/ dışındaki yollar silinemez.
"""

import io
import re
import zipfile

import pytest

from app.config import settings
from app.services import file_service
from app.utils import file_validation
from app.utils.file_validation import (
    FileValidationError,
    read_upload_limited,
    validate_upload,
)


def _make_zip(entries: dict[str, bytes]) -> bytes:
    buffer = io.BytesIO()
    with zipfile.ZipFile(buffer, "w", zipfile.ZIP_DEFLATED) as archive:
        for name, data in entries.items():
            archive.writestr(name, data)
    return buffer.getvalue()


def _minimal_docx() -> bytes:
    return _make_zip({
        "[Content_Types].xml": b"<Types/>",
        "word/document.xml": b"<w:document/>",
    })


# --- validate_upload -------------------------------------------------------


def test_unsupported_extension_is_rejected():
    with pytest.raises(FileValidationError) as exc:
        validate_upload("zararli.exe", b"MZ\x90\x00")
    assert exc.value.status_code == 415


def test_missing_extension_is_rejected():
    with pytest.raises(FileValidationError):
        validate_upload("uzantisiz", b"icerik")


def test_empty_file_is_rejected():
    with pytest.raises(FileValidationError) as exc:
        validate_upload("bos.pdf", b"")
    assert exc.value.status_code == 400


def test_oversized_file_is_rejected(monkeypatch):
    monkeypatch.setattr(settings, "MAX_FILE_SIZE_MB", 1)
    too_big = b"x" * (1024 * 1024 + 1)
    with pytest.raises(FileValidationError) as exc:
        validate_upload("buyuk.txt", too_big)
    assert exc.value.status_code == 413


def test_pdf_with_wrong_magic_byte_is_rejected():
    with pytest.raises(FileValidationError) as exc:
        validate_upload("sahte.pdf", b"BU BIR PDF DEGIL")
    assert exc.value.status_code == 415


def test_valid_pdf_magic_byte_is_accepted():
    assert validate_upload("gercek.pdf", b"%PDF-1.7 icerik") == "pdf"


def test_binary_content_with_txt_extension_is_rejected():
    with pytest.raises(FileValidationError) as exc:
        validate_upload("ikili.txt", b"metin\x00binary")
    assert exc.value.status_code == 415


def test_valid_txt_is_accepted():
    assert validate_upload("notlar.txt", "türkçe metin".encode()) == "txt"


# --- read_upload_limited -----------------------------------------------------


def test_read_upload_limited_returns_content_within_limit(monkeypatch):
    monkeypatch.setattr(settings, "MAX_FILE_SIZE_MB", 1)
    content = b"a" * 1024
    assert read_upload_limited(io.BytesIO(content)) == content


def test_read_upload_limited_rejects_oversized_stream(monkeypatch):
    # Sınır, akış okunurken uygulanır: içerik tamamen belleğe alınmadan 413.
    monkeypatch.setattr(settings, "MAX_FILE_SIZE_MB", 1)
    oversized = io.BytesIO(b"a" * (1024 * 1024 + 1))
    with pytest.raises(FileValidationError) as exc:
        read_upload_limited(oversized)
    assert exc.value.status_code == 413


# --- DOCX zip sertleştirmesi --------------------------------------------------


@pytest.fixture(autouse=True)
def _allow_docx(monkeypatch):
    monkeypatch.setattr(settings, "ALLOWED_EXTENSIONS", "pdf,txt,docx")


def test_valid_docx_zip_is_accepted():
    assert validate_upload("rapor.docx", _minimal_docx()) == "docx"


def test_docx_with_pk_header_but_invalid_zip_is_rejected():
    # Magic byte (PK) tek başına yeterli değildir; zip yapısı doğrulanır.
    fake = b"PK\x03\x04" + b"bozuk-veri" * 10
    with pytest.raises(FileValidationError) as exc:
        validate_upload("bozuk.docx", fake)
    assert exc.value.status_code == 415


def test_docx_zip_bomb_is_rejected(monkeypatch):
    # Açılmış toplam boyut sınırı aşan arşiv reddedilir (zip bomb önlemi).
    monkeypatch.setattr(file_validation, "_DOCX_MAX_UNCOMPRESSED_BYTES", 1024)
    bomb = _make_zip({"word/document.xml": b"0" * 4096})
    with pytest.raises(FileValidationError) as exc:
        validate_upload("bomba.docx", bomb)
    assert exc.value.status_code == 415


def test_docx_with_too_many_entries_is_rejected(monkeypatch):
    monkeypatch.setattr(file_validation, "_DOCX_MAX_ENTRIES", 3)
    crowded = _make_zip({f"word/{i}.xml": b"x" for i in range(5)})
    with pytest.raises(FileValidationError) as exc:
        validate_upload("kalabalik.docx", crowded)
    assert exc.value.status_code == 415


def test_docx_with_path_traversal_entry_is_rejected():
    evil = _make_zip({
        "word/document.xml": b"<w:document/>",
        "../../../tmp/evil.sh": b"#!/bin/sh",
    })
    with pytest.raises(FileValidationError) as exc:
        validate_upload("sinsi.docx", evil)
    assert exc.value.status_code == 415


def test_docx_with_absolute_path_entry_is_rejected():
    evil = _make_zip({"/etc/cron.d/evil": b"x"})
    with pytest.raises(FileValidationError):
        validate_upload("mutlak.docx", evil)


# --- sanitize_filename ---------------------------------------------------------


def test_sanitize_strips_path_traversal_components():
    assert file_service.sanitize_filename("../../etc/passwd") == "passwd"


def test_sanitize_neutralizes_windows_style_traversal():
    result = file_service.sanitize_filename("..\\..\\gizli.pdf")
    assert "\\" not in result and "/" not in result
    assert ".." not in result


def test_sanitize_replaces_unsafe_characters():
    result = file_service.sanitize_filename("rapor: 2026/çeyrek?.pdf")
    assert re.fullmatch(r"[A-Za-z0-9._-]+", result)


def test_sanitize_empty_name_falls_back_to_default():
    assert file_service.sanitize_filename("///") == "dosya"


# --- save_upload / delete_file ---------------------------------------------------


def test_save_upload_stores_uuid_based_filename(tmp_path, monkeypatch):
    monkeypatch.setattr(file_service, "UPLOAD_PATH", tmp_path)
    saved = file_service.save_upload(b"%PDF-1.7", "../../rapor sonu!.pdf", "pdf")

    # Diskteki ad UUID tabanlıdır; kullanıcı girdisinden türetilmez.
    assert re.fullmatch(r"[0-9a-f]{32}\.pdf", saved.stored_filename)
    assert (tmp_path / saved.stored_filename).read_bytes() == b"%PDF-1.7"
    # Orijinal ad sanitize edilerek saklanır.
    assert "/" not in saved.original_filename
    assert ".." not in saved.original_filename


def test_delete_file_outside_uploads_raises(tmp_path, monkeypatch):
    monkeypatch.setattr(file_service, "UPLOAD_PATH", tmp_path / "uploads")
    outside = tmp_path / "gizli.txt"
    outside.write_text("dokunma")

    with pytest.raises(ValueError):
        file_service.delete_file(str(outside))
    assert outside.exists()


def test_delete_file_with_traversal_path_raises(tmp_path, monkeypatch):
    uploads = tmp_path / "uploads"
    uploads.mkdir()
    monkeypatch.setattr(file_service, "UPLOAD_PATH", uploads)

    with pytest.raises(ValueError):
        file_service.delete_file(str(uploads / ".." / "gizli.txt"))


def test_delete_file_inside_uploads_succeeds(tmp_path, monkeypatch):
    uploads = tmp_path / "uploads"
    uploads.mkdir()
    monkeypatch.setattr(file_service, "UPLOAD_PATH", uploads)
    target = uploads / "abc123.pdf"
    target.write_bytes(b"%PDF")

    assert file_service.delete_file(str(target)) is True
    assert not target.exists()


def test_delete_missing_file_returns_false(tmp_path, monkeypatch):
    uploads = tmp_path / "uploads"
    uploads.mkdir()
    monkeypatch.setattr(file_service, "UPLOAD_PATH", uploads)

    assert file_service.delete_file(str(uploads / "yok.pdf")) is False
