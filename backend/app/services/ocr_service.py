"""Lokal OCR servisi.

Taranmış PDF sayfalarını ve görüntü dosyalarını metne çevirir. Tamamen lokal
çalışır; hiçbir bulut/API çağrısı yapılmaz (proje ilkesi: doküman içeriği
makineden çıkmaz).

Motor seçimi (`OCR_ENGINE`):
- ``auto``      : Önce Tesseract (sistemde kuruluysa), yoksa EasyOCR.
- ``tesseract`` : pytesseract + sistemdeki tesseract binary'si. En olgun
  Türkçe desteği (`tur` traineddata); Windows'ta ayrıca kurulum ister.
- ``easyocr``   : Saf pip bağımlılığı (PyTorch zaten sentence-transformers ile
  kurulu). İlk kullanımda tanıma modellerini lokal diske indirir (ücretsiz).
- ``off``       : OCR kapalı; çağıran taraf sayfaları "failed" işaretler.

PDF sayfaları görüntüye `pypdfium2` ile çevrilir (pdfplumber'ın zaten kurulu
bağımlılığı; poppler gibi ek sistem kurulumu gerekmez).

Motor örneği süreç başına bir kez (lazy singleton) oluşturulur; EasyOCR model
yüklemesi pahalı olduğu için bu önemlidir. Hiçbir motor kullanılamıyorsa
`is_available()` False döner ve pipeline OCR'sız (sayfaları "failed"
işaretleyerek) devam eder — uygulama çökmez.
"""

from __future__ import annotations

import logging
import shutil
import threading
from dataclasses import dataclass
from functools import lru_cache
from typing import TYPE_CHECKING, Optional, Protocol

from app.config import settings

if TYPE_CHECKING:  # pragma: no cover - yalnızca tip denetimi için
    from PIL.Image import Image

logger = logging.getLogger(__name__)

_engine_lock = threading.Lock()

# Tesseract dil kodu -> EasyOCR dil kodu eşlemesi. `OCR_LANGS` Tesseract
# biçiminde ("tur+eng") tutulur; EasyOCR kullanılırsa otomatik çevrilir.
_TESSERACT_TO_EASYOCR = {
    "tur": "tr",
    "eng": "en",
    "deu": "de",
    "fra": "fr",
    "spa": "es",
    "ara": "ar",
    "rus": "ru",
}

# Windows'ta tesseract PATH'te olmayabilir; yaygın kurulum yolları denenir.
_TESSERACT_WINDOWS_PATHS = (
    r"C:\Program Files\Tesseract-OCR\tesseract.exe",
    r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
)


class OCRError(Exception):
    """OCR işlemi sırasında oluşan hata."""


@dataclass(frozen=True)
class OCRResult:
    """Tek bir görüntünün OCR çıktısı."""

    text: str
    confidence: float | None  # 0-1 aralığında ortalama güven; bilinmiyorsa None
    engine: str


class _Engine(Protocol):  # pragma: no cover - yalnızca tip sözleşmesi
    name: str

    def ocr(self, image: "Image") -> OCRResult: ...


def _tesseract_langs() -> str:
    """`OCR_LANGS` değerini Tesseract biçiminde döner (ör. "tur+eng")."""
    return settings.OCR_LANGS.strip() or "tur+eng"


def _easyocr_langs() -> list[str]:
    """`OCR_LANGS` değerini EasyOCR dil listesine çevirir (ör. ["tr", "en"])."""
    langs = []
    for part in _tesseract_langs().split("+"):
        part = part.strip().lower()
        if not part:
            continue
        langs.append(_TESSERACT_TO_EASYOCR.get(part, part))
    return langs or ["tr", "en"]


class _TesseractEngine:
    """pytesseract sarmalayıcısı (kelime güvenleriyle birlikte)."""

    name = "tesseract"

    def __init__(self) -> None:
        import pytesseract

        binary = shutil.which("tesseract")
        if binary is None:
            for candidate in _TESSERACT_WINDOWS_PATHS:
                if shutil.which(candidate) or _file_exists(candidate):
                    binary = candidate
                    break
        if binary is None:
            raise OCRError("tesseract binary'si bulunamadı.")

        pytesseract.pytesseract.tesseract_cmd = binary
        # Kurulumu doğrula (binary bozuksa burada patlar, sessizce sonra değil).
        pytesseract.get_tesseract_version()
        self._pytesseract = pytesseract

    def ocr(self, image: "Image") -> OCRResult:
        data = self._pytesseract.image_to_data(
            image,
            lang=_tesseract_langs(),
            output_type=self._pytesseract.Output.DICT,
        )
        # Kelimeleri (block, paragraph, line) sırasına göre satırlara grupla;
        # böylece image_to_string için ikinci bir OCR koşusu gerekmez.
        lines: dict[tuple[int, int, int], list[str]] = {}
        confidences: list[float] = []
        for word, conf, block, par, line in zip(
            data["text"], data["conf"], data["block_num"],
            data["par_num"], data["line_num"],
        ):
            word = (word or "").strip()
            if not word:
                continue
            conf_value = float(conf)
            if conf_value >= 0:  # -1 = güven bilgisi yok (satır/blok kayıtları)
                confidences.append(conf_value)
            lines.setdefault((block, par, line), []).append(word)

        text = "\n".join(" ".join(words) for words in lines.values())
        confidence = (
            round(sum(confidences) / len(confidences) / 100.0, 4)
            if confidences
            else None
        )
        return OCRResult(text=text, confidence=confidence, engine=self.name)


class _EasyOCREngine:
    """EasyOCR sarmalayıcısı (pip-only; modeller ilk kullanımda lokal iner)."""

    name = "easyocr"

    def __init__(self) -> None:
        import easyocr

        gpu = False
        try:
            import torch

            gpu = bool(torch.cuda.is_available())
        except Exception:  # pragma: no cover - torch her zaman kurulu
            pass

        logger.info(
            "EasyOCR başlatılıyor (diller=%s, gpu=%s). İlk çalıştırmada "
            "tanıma modelleri lokal diske indirilir.",
            _easyocr_langs(),
            gpu,
        )
        self._reader = easyocr.Reader(_easyocr_langs(), gpu=gpu, verbose=False)

    def ocr(self, image: "Image") -> OCRResult:
        import numpy as np

        results = self._reader.readtext(np.asarray(image.convert("RGB")))
        parts: list[str] = []
        weighted_conf = 0.0
        total_weight = 0
        for _bbox, text, conf in results:
            text = (text or "").strip()
            if not text:
                continue
            parts.append(text)
            weighted_conf += float(conf) * len(text)
            total_weight += len(text)

        confidence = (
            round(weighted_conf / total_weight, 4) if total_weight else None
        )
        return OCRResult(
            text="\n".join(parts), confidence=confidence, engine=self.name
        )


def _file_exists(path: str) -> bool:
    from pathlib import Path

    return Path(path).is_file()


def _try_build(engine_cls: type) -> Optional[_Engine]:
    """Motoru kurmayı dener; kurulamazsa None döner (import/binary eksikliği)."""
    try:
        return engine_cls()
    except Exception as exc:
        logger.info("OCR motoru kullanılamıyor (%s): %s", engine_cls.name, exc)
        return None


@lru_cache(maxsize=1)
def _resolve_engine() -> Optional[_Engine]:
    """`OCR_ENGINE` ayarına göre kullanılabilir ilk motoru döner (singleton)."""
    if not settings.OCR_ENABLED:
        return None

    choice = settings.OCR_ENGINE.strip().lower()
    if choice == "off":
        return None

    candidates: list[type]
    if choice == "tesseract":
        candidates = [_TesseractEngine]
    elif choice == "easyocr":
        candidates = [_EasyOCREngine]
    else:  # auto
        candidates = [_TesseractEngine, _EasyOCREngine]

    for engine_cls in candidates:
        engine = _try_build(engine_cls)
        if engine is not None:
            logger.info("OCR motoru hazır: %s", engine.name)
            return engine

    logger.warning(
        "Hiçbir OCR motoru kullanılamıyor (OCR_ENGINE=%s). Taranmış "
        "sayfalar/görüntüler işlenemeyecek. Tesseract kurun veya "
        "`pip install easyocr` çalıştırın.",
        settings.OCR_ENGINE,
    )
    return None


def get_engine() -> Optional[_Engine]:
    """Aktif OCR motorunu döner (yoksa None). Thread-safe."""
    with _engine_lock:
        return _resolve_engine()


def reset_engine_cache() -> None:
    """Motor önbelleğini sıfırlar (test ve konfigürasyon değişimi için)."""
    with _engine_lock:
        _resolve_engine.cache_clear()


def is_available() -> bool:
    """En az bir OCR motoru kullanılabilir mi?"""
    return get_engine() is not None


def engine_name() -> str | None:
    """Aktif motorun adını döner (yoksa None)."""
    engine = get_engine()
    return engine.name if engine else None


def render_pdf_page(
    file_path: str, page_index: int, dpi: int | None = None
) -> "Image":
    """PDF'in tek bir sayfasını PIL görüntüsüne çevirir (pypdfium2 ile).

    `page_index` 0 tabanlıdır. Sayfa sayfa render edilir; büyük PDF'lerde tüm
    sayfaların aynı anda belleğe alınmasını önlemek için çağıran taraf her
    sayfayı işleyip bırakmalıdır.
    """
    try:
        import pypdfium2 as pdfium
    except ImportError as exc:  # pragma: no cover - pdfplumber bağımlılığı
        raise OCRError("pypdfium2 kurulu değil.") from exc

    scale = (dpi or settings.OCR_RENDER_DPI) / 72.0
    try:
        pdf = pdfium.PdfDocument(file_path)
    except Exception as exc:
        raise OCRError(f"PDF render için açılamadı: {exc}") from exc

    try:
        page = pdf[page_index]
        try:
            bitmap = page.render(scale=scale)
            try:
                return bitmap.to_pil()
            finally:
                bitmap.close()
        finally:
            page.close()
    except OCRError:
        raise
    except Exception as exc:
        raise OCRError(f"Sayfa render edilemedi: {exc}") from exc
    finally:
        pdf.close()


def ocr_image(image: "Image") -> OCRResult | None:
    """Bir PIL görüntüsünü OCR'dan geçirir; motor yoksa None döner."""
    engine = get_engine()
    if engine is None:
        return None
    try:
        return engine.ocr(image)
    except Exception as exc:
        raise OCRError(f"OCR başarısız: {exc}") from exc


def ocr_pdf_page(file_path: str, page_index: int) -> OCRResult | None:
    """PDF'in tek sayfasını render edip OCR'dan geçirir.

    Motor yoksa None döner; render/OCR hatasında `OCRError` fırlatır.
    """
    if get_engine() is None:
        return None
    image = render_pdf_page(file_path, page_index)
    try:
        return ocr_image(image)
    finally:
        image.close()


def ocr_image_file(file_path: str) -> OCRResult | None:
    """Diskteki bir görüntü dosyasını OCR'dan geçirir.

    Motor yoksa None döner; dosya açılamazsa/OCR patlarsa `OCRError` fırlatır.
    """
    if get_engine() is None:
        return None
    try:
        from PIL import Image as PILImage

        image = PILImage.open(file_path)
    except Exception as exc:
        raise OCRError(f"Görüntü dosyası açılamadı: {exc}") from exc

    try:
        return ocr_image(image)
    finally:
        image.close()
