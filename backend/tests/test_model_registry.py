"""Model allowlist kayıt defteri birim testleri (Hafta 6).

`LLM_ALLOWED_MODELS` ayrıştırma, legacy tek model geri dönüşü, mod/enabled
filtreleri ve `resolve_allowed_model` doğrulaması test edilir. Ayarlar
monkeypatch ile değiştirilir; dış bağımlılık yoktur.
"""

import json

import pytest

from app.config import settings
from app.services import model_registry
from app.services.model_registry import ModelNotAllowedError


def _set_models(monkeypatch, entries) -> None:
    monkeypatch.setattr(settings, "LLM_ALLOWED_MODELS", json.dumps(entries))


_BASE_ENTRY = {
    "id": "model-a", "label": "Model A", "context_window": 8192,
    "max_output_tokens": 512, "temperature": 0.2, "enabled": True,
    "modes": ["rag", "general"],
}


# --- Geriye uyumluluk (legacy tek model) -----------------------------------


def test_empty_allowlist_falls_back_to_legacy_single_model(monkeypatch):
    monkeypatch.setattr(settings, "LLM_ALLOWED_MODELS", "")
    models = model_registry.get_allowed_models()
    assert len(models) == 1
    model = models[0]
    assert model.id == settings.LLM_MODEL_NAME
    assert model.context_window == settings.LLM_CONTEXT_WINDOW
    assert model.max_output_tokens == settings.LLM_MAX_TOKENS
    assert model.temperature == settings.LLM_TEMPERATURE
    assert model.modes == ("rag", "general")


def test_invalid_json_falls_back_to_legacy(monkeypatch):
    monkeypatch.setattr(settings, "LLM_ALLOWED_MODELS", "bu json değil {")
    models = model_registry.get_allowed_models()
    assert len(models) == 1
    assert models[0].id == settings.LLM_MODEL_NAME


def test_entry_without_id_is_skipped(monkeypatch):
    _set_models(monkeypatch, [
        {"label": "kimliksiz"},
        _BASE_ENTRY,
    ])
    models = model_registry.get_allowed_models()
    assert [m.id for m in models] == ["model-a"]


# --- Ayrıştırma --------------------------------------------------------------


def test_parses_full_entry(monkeypatch):
    _set_models(monkeypatch, [_BASE_ENTRY])
    model = model_registry.get_allowed_models()[0]
    assert model.id == "model-a"
    assert model.label == "Model A"
    assert model.context_window == 8192
    assert model.max_output_tokens == 512
    assert model.temperature == 0.2
    assert model.enabled is True
    assert model.modes == ("rag", "general")


def test_missing_optional_fields_use_defaults(monkeypatch):
    _set_models(monkeypatch, [{"id": "sade-model"}])
    model = model_registry.get_allowed_models()[0]
    assert model.label == "sade-model"
    assert model.context_window == settings.LLM_CONTEXT_WINDOW
    assert model.max_output_tokens == settings.LLM_MAX_TOKENS
    assert model.temperature == settings.LLM_TEMPERATURE
    assert model.enabled is True
    assert model.modes == ("rag", "general")


def test_unknown_modes_are_dropped_and_modeless_entry_skipped(monkeypatch):
    _set_models(monkeypatch, [
        {**_BASE_ENTRY, "id": "m1", "modes": ["rag", "acayip-mod"]},
        {**_BASE_ENTRY, "id": "m2", "modes": ["acayip-mod"]},
    ])
    models = model_registry.get_allowed_models()
    assert [m.id for m in models] == ["m1"]
    assert models[0].modes == ("rag",)


# --- Kullanıcı/mod filtreleri -------------------------------------------------


def test_disabled_models_are_not_available(monkeypatch):
    _set_models(monkeypatch, [
        {**_BASE_ENTRY, "id": "acik"},
        {**_BASE_ENTRY, "id": "kapali", "enabled": False},
    ])
    models = model_registry.get_available_models_for_user(None, "rag")
    assert [m.id for m in models] == ["acik"]


def test_mode_filter(monkeypatch):
    _set_models(monkeypatch, [
        {**_BASE_ENTRY, "id": "sadece-rag", "modes": ["rag"]},
        {**_BASE_ENTRY, "id": "sadece-genel", "modes": ["general"]},
    ])
    assert [
        m.id for m in model_registry.get_available_models_for_user(None, "rag")
    ] == ["sadece-rag"]
    assert [
        m.id
        for m in model_registry.get_available_models_for_user(None, "general")
    ] == ["sadece-genel"]


# --- resolve_allowed_model ----------------------------------------------------


def test_resolve_none_returns_default_model(monkeypatch):
    _set_models(monkeypatch, [
        {**_BASE_ENTRY, "id": "birinci"},
        {**_BASE_ENTRY, "id": "ikinci"},
    ])
    assert model_registry.resolve_allowed_model(None, None, "rag").id == "birinci"
    assert model_registry.resolve_allowed_model(None, "  ", "rag").id == "birinci"


def test_resolve_valid_id(monkeypatch):
    _set_models(monkeypatch, [
        {**_BASE_ENTRY, "id": "birinci"},
        {**_BASE_ENTRY, "id": "ikinci"},
    ])
    assert model_registry.resolve_allowed_model(None, "ikinci", "rag").id == "ikinci"


def test_resolve_unknown_id_raises(monkeypatch):
    _set_models(monkeypatch, [_BASE_ENTRY])
    with pytest.raises(ModelNotAllowedError):
        model_registry.resolve_allowed_model(None, "olmayan", "rag")


def test_resolve_disabled_model_raises(monkeypatch):
    _set_models(monkeypatch, [
        _BASE_ENTRY,
        {**_BASE_ENTRY, "id": "kapali", "enabled": False},
    ])
    with pytest.raises(ModelNotAllowedError):
        model_registry.resolve_allowed_model(None, "kapali", "rag")


def test_resolve_wrong_mode_raises(monkeypatch):
    _set_models(monkeypatch, [
        _BASE_ENTRY,
        {**_BASE_ENTRY, "id": "sadece-rag", "modes": ["rag"]},
    ])
    with pytest.raises(ModelNotAllowedError):
        model_registry.resolve_allowed_model(None, "sadece-rag", "general")
