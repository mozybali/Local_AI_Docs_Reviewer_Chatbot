"""LLM model allowlist kayıt defteri (Hafta 6).

Kullanıcının sohbet ekranlarında seçebileceği modeller `.env` içindeki
`LLM_ALLOWED_MODELS` JSON listesinden okunur. Değişken tanımlı değilse veya
boşsa geriye uyumluluk için mevcut `LLM_MODEL_NAME`, `LLM_TEMPERATURE`,
`LLM_MAX_TOKENS` ve `LLM_CONTEXT_WINDOW` değerlerinden tek varsayılan model
üretilir.

Güvenlik ilkesi: model seçimi ve üretim parametreleri (context_window,
max_output_tokens, temperature) YALNIZCA bu sunucu tarafı tanımlardan gelir.
İstemciden yalnızca `model_id` kabul edilir ve buradaki allowlist'e göre
doğrulanır; izinsiz/pasif/mod uyumsuz bir model istenirse
`ModelNotAllowedError` fırlatılır (router 400'e çevirir).

Not: `max_output_tokens` çıktı token limitidir, `context_window` ise modelin
toplam bağlam penceresidir; bu iki kavram karıştırılmamalıdır (bütçe hesabı
için bkz. `llm_service.input_token_budget`).
"""

from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from functools import lru_cache
from typing import TYPE_CHECKING

from app.config import settings

if TYPE_CHECKING:  # pragma: no cover - yalnızca tip denetimi için
    from app.models.user import User

logger = logging.getLogger(__name__)

# Desteklenen sohbet modları: "rag" (doküman soru-cevap) ve "general" (normal
# sohbet). Model tanımındaki `modes` alanı bu değerlerle sınırlıdır.
VALID_MODES = ("rag", "general")

_MODEL_NOT_ALLOWED_MESSAGE = (
    "Geçersiz model seçimi. Lütfen listeden izinli bir model seçin."
)
_NO_MODEL_AVAILABLE_MESSAGE = (
    "Bu sohbet modu için kullanılabilir bir model tanımlı değil."
)


class ModelNotAllowedError(Exception):
    """İstenen model allowlist'te yok/pasif/mod uyumsuz (kullanıcıya 400).

    `str(exc)` doğrudan kullanıcıya gösterilebilecek Türkçe bir mesaj içerir.
    """


@dataclass(frozen=True)
class ModelConfig:
    """Sunucu tarafında tanımlı tek bir LLM modelinin konfigürasyonu."""

    id: str
    label: str
    context_window: int
    max_output_tokens: int
    temperature: float
    enabled: bool = True
    modes: tuple[str, ...] = VALID_MODES


def get_allowed_models() -> tuple[ModelConfig, ...]:
    """Tanımlı model allowlist'ini döner.

    `LLM_ALLOWED_MODELS` boşsa ya da içinden geçerli hiçbir model
    çıkarılamazsa legacy LLM_* ayarlarından tek varsayılan model üretilir;
    böylece eski `.env` dosyalarıyla davranış değişmez.
    """
    raw = (settings.LLM_ALLOWED_MODELS or "").strip()
    if raw:
        models = _parse_models(raw)
        if models:
            return models
    return (_legacy_default_model(),)


def get_available_models_for_user(
    user: "User | None", mode: str
) -> list[ModelConfig]:
    """Kullanıcının verilen modda seçebileceği (aktif) modelleri döner.

    Şimdilik tüm kullanıcılar aynı allowlist'i görür; imza, ileride role göre
    daraltma yapılabilsin diye kullanıcıyı da alır. Listedeki ilk model o mod
    için varsayılan kabul edilir.
    """
    return [
        model
        for model in get_allowed_models()
        if model.enabled and mode in model.modes
    ]


def resolve_allowed_model(
    user: "User | None", model_id: str | None, mode: str
) -> ModelConfig:
    """İstemciden gelen `model_id` değerini allowlist'e göre doğrular.

    - `model_id` boş/None ise o modun varsayılan (ilk aktif) modeli döner.
    - `model_id` izinli listede yoksa `ModelNotAllowedError` fırlatır; hangi
      modellerin tanımlı olduğu mesajda sızdırılmaz.
    """
    models = get_available_models_for_user(user, mode)
    if not models:
        raise ModelNotAllowedError(_NO_MODEL_AVAILABLE_MESSAGE)

    if model_id is None or not model_id.strip():
        return models[0]

    for model in models:
        if model.id == model_id:
            return model
    raise ModelNotAllowedError(_MODEL_NOT_ALLOWED_MESSAGE)


def _legacy_default_model() -> ModelConfig:
    """Legacy LLM_* ayarlarından tek varsayılan model üretir (geriye uyum)."""
    return ModelConfig(
        id=settings.LLM_MODEL_NAME,
        label=settings.LLM_MODEL_NAME,
        context_window=settings.LLM_CONTEXT_WINDOW,
        max_output_tokens=settings.LLM_MAX_TOKENS,
        temperature=settings.LLM_TEMPERATURE,
        enabled=True,
        modes=VALID_MODES,
    )


@lru_cache(maxsize=8)
def _parse_models(raw: str) -> tuple[ModelConfig, ...]:
    """`LLM_ALLOWED_MODELS` JSON metnini ModelConfig listesine çevirir.

    Hatalı konfigürasyon isteğe kadar sızmasın diye ayrıştırma savunmacıdır:
    geçersiz JSON ya da geçersiz girişler loglanır ve atlanır; hiçbir geçerli
    giriş kalmazsa çağıran taraf legacy varsayılana düşer. Ham metin cache
    anahtarı olduğundan testlerde farklı değerler sorunsuz çalışır.
    """
    try:
        entries = json.loads(raw)
    except ValueError:
        logger.error(
            "LLM_ALLOWED_MODELS geçerli JSON değil; legacy tek model "
            "varsayılanına düşülüyor."
        )
        return ()

    if not isinstance(entries, list):
        logger.error(
            "LLM_ALLOWED_MODELS bir JSON listesi olmalı; legacy tek model "
            "varsayılanına düşülüyor."
        )
        return ()

    models: list[ModelConfig] = []
    for index, entry in enumerate(entries):
        model = _parse_entry(index, entry)
        if model is not None:
            models.append(model)
    return tuple(models)


def _parse_entry(index: int, entry: object) -> ModelConfig | None:
    """Tek bir allowlist girişini doğrular; geçersizse loglayıp None döner."""
    if not isinstance(entry, dict):
        logger.error("LLM_ALLOWED_MODELS[%s] bir JSON nesnesi değil; atlandı.", index)
        return None

    model_id = entry.get("id")
    if not isinstance(model_id, str) or not model_id.strip():
        logger.error(
            "LLM_ALLOWED_MODELS[%s] geçerli bir 'id' içermiyor; atlandı.", index
        )
        return None
    model_id = model_id.strip()

    label = entry.get("label")
    if not isinstance(label, str) or not label.strip():
        label = model_id

    context_window = _positive_int(
        entry.get("context_window"), settings.LLM_CONTEXT_WINDOW
    )
    max_output_tokens = _positive_int(
        entry.get("max_output_tokens"), settings.LLM_MAX_TOKENS
    )

    temperature = entry.get("temperature", settings.LLM_TEMPERATURE)
    if not isinstance(temperature, (int, float)) or isinstance(temperature, bool):
        temperature = settings.LLM_TEMPERATURE

    enabled = entry.get("enabled", True)
    if not isinstance(enabled, bool):
        enabled = bool(enabled)

    raw_modes = entry.get("modes", list(VALID_MODES))
    if not isinstance(raw_modes, list):
        raw_modes = list(VALID_MODES)
    modes = tuple(m for m in raw_modes if m in VALID_MODES)
    if not modes:
        logger.error(
            "LLM_ALLOWED_MODELS[%s] (%s) geçerli bir mod içermiyor; atlandı.",
            index,
            model_id,
        )
        return None

    return ModelConfig(
        id=model_id,
        label=label.strip(),
        context_window=context_window,
        max_output_tokens=max_output_tokens,
        temperature=float(temperature),
        enabled=enabled,
        modes=modes,
    )


def _positive_int(value: object, fallback: int) -> int:
    """Pozitif tam sayı bekleyen alanlar için savunmacı dönüşüm."""
    if isinstance(value, bool) or not isinstance(value, int) or value <= 0:
        return fallback
    return value
