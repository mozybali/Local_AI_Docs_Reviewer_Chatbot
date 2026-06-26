"""Lokal LLM servisi birim testleri (Hafta 4).

Gerçek bir LLM sunucusu (LM Studio) gerektirmez: HTTP sınırı `_http_post`
monkeypatch ile taklit edilir. Böylece RAG mantığı (boş bağlam kısa devresi,
prompt kurgusu, yanıt ayrıştırma ve hata yönetimi) izole şekilde test edilir.
"""

import httpx
import pytest

from app.services import llm_service
from app.services.llm_service import LLMServiceError, NO_ANSWER
from app.services.retrieval_service import RetrievedChunk


def _chunk(text="Yıllık izin en az 5 iş günü önce talep edilir.",
           document="personel_yonetmeligi.pdf", page=4, chunk_index=12,
           score=0.91):
    return RetrievedChunk(
        text=text, score=score, document_id=1, document=document,
        page=page, chunk_index=chunk_index,
    )


class _FakeResponse:
    """httpx.Response yerine geçen minimal sahte yanıt."""

    def __init__(self, status_code: int, payload: dict | None = None,
                 text: str = ""):
        self.status_code = status_code
        self._payload = payload or {}
        self.text = text

    def json(self) -> dict:
        return self._payload


def _ok_payload(content: str) -> dict:
    return {"choices": [{"message": {"role": "assistant", "content": content}}]}


# --- Boş bağlam kısa devresi --------------------------------------------


def test_generate_answer_without_chunks_returns_standard_answer(monkeypatch):
    called = {"v": False}

    def fake_post(*args, **kwargs):
        called["v"] = True
        return _FakeResponse(200, _ok_payload("x"))

    monkeypatch.setattr(llm_service, "_http_post", fake_post)
    # Bağlam yoksa LLM hiç çağrılmadan standart yanıt dönmeli (hallucination önlemi).
    assert llm_service.generate_answer("herhangi bir soru", []) == NO_ANSWER
    assert called["v"] is False


# --- Prompt kurgusu ------------------------------------------------------


def test_build_messages_includes_rules_question_and_sources():
    messages = llm_service.build_messages("Yıllık izin kaç gün önce?", [_chunk()])
    assert messages[0]["role"] == "system"
    assert NO_ANSWER in messages[0]["content"]  # kural #6 standart cevabı içerir
    user = messages[1]["content"]
    assert "Yıllık izin kaç gün önce?" in user
    assert "personel_yonetmeligi.pdf" in user
    assert "sayfa 4" in user
    assert "Yıllık izin en az 5 iş günü" in user


# --- Başarılı üretim -----------------------------------------------------


def test_generate_answer_returns_model_content(monkeypatch):
    monkeypatch.setattr(
        llm_service, "_http_post",
        lambda path, payload: _FakeResponse(200, _ok_payload("  5 iş günü önce.  ")),
    )
    answer = llm_service.generate_answer("soru", [_chunk()])
    assert answer == "5 iş günü önce."  # kenar boşlukları kırpılır


def test_inline_sources_section_is_stripped(monkeypatch):
    # Model kurala rağmen cevabın sonuna bir "Kaynaklar:" listesi eklerse, bu
    # bölüm ayıklanmalı (kaynaklar arayüzde ayrı panelde gösterilir).
    content = (
        "Yıllık izin en az 5 iş günü önce talep edilir.\n\n"
        "Kaynaklar:\n"
        "[Kaynak 1] personel_yonetmeligi.pdf\n"
        "[Kaynak 2] personel_yonetmeligi.pdf"
    )
    monkeypatch.setattr(
        llm_service, "_http_post",
        lambda path, payload: _FakeResponse(200, _ok_payload(content)),
    )
    answer = llm_service.generate_answer("soru", [_chunk()])
    assert answer == "Yıllık izin en az 5 iş günü önce talep edilir."


def test_markdown_sources_heading_is_stripped(monkeypatch):
    # Markdown ile yazılmış başlık (**Kaynaklar:**) da ayıklanmalı.
    content = "Kısa cevap.\n\n**Kaynaklar:** [Kaynak 1] a.pdf"
    monkeypatch.setattr(
        llm_service, "_http_post",
        lambda path, payload: _FakeResponse(200, _ok_payload(content)),
    )
    assert llm_service.generate_answer("soru", [_chunk()]) == "Kısa cevap."


def test_answer_without_sources_section_is_untouched(monkeypatch):
    # İçinde "kaynak" kelimesi geçen ama kaynak listesi olmayan cevap bozulmamalı.
    content = "Bu konuda güvenilir kaynaklar bağlamda mevcuttur."
    monkeypatch.setattr(
        llm_service, "_http_post",
        lambda path, payload: _FakeResponse(200, _ok_payload(content)),
    )
    assert llm_service.generate_answer("soru", [_chunk()]) == content


def test_model_returned_no_answer_is_preserved(monkeypatch):
    # Bağlam dolu ama soru alakasız: model prompt kuralı #6 gereği standart cevabı
    # döndürürse, bu metin olduğu gibi korunmalı (NO_ANSWER'a sadık kalınır).
    monkeypatch.setattr(
        llm_service, "_http_post",
        lambda path, payload: _FakeResponse(200, _ok_payload(NO_ANSWER)),
    )
    assert llm_service.generate_answer("alakasız soru", [_chunk()]) == NO_ANSWER


def test_generate_answer_sends_configured_model(monkeypatch):
    seen = {}

    def fake_post(path, payload):
        seen["path"] = path
        seen["payload"] = payload
        return _FakeResponse(200, _ok_payload("cevap"))

    monkeypatch.setattr(llm_service, "_http_post", fake_post)
    llm_service.generate_answer("soru", [_chunk()])
    assert seen["path"] == "/chat/completions"
    assert seen["payload"]["model"]  # .env'deki model adı geçer
    assert seen["payload"]["stream"] is False
    assert len(seen["payload"]["messages"]) == 2


# --- Hata yönetimi -------------------------------------------------------


def test_connection_error_raises_llm_service_error(monkeypatch):
    def boom(path, payload):
        raise httpx.ConnectError("bağlanılamadı")

    monkeypatch.setattr(llm_service, "_http_post", boom)
    with pytest.raises(LLMServiceError) as exc:
        llm_service.generate_answer("soru", [_chunk()])
    # Kullanıcıya gösterilecek mesaj LM Studio'yu işaret etmeli.
    assert "LM Studio" in str(exc.value)


def test_timeout_raises_llm_service_error(monkeypatch):
    def boom(path, payload):
        raise httpx.TimeoutException("zaman aşımı")

    monkeypatch.setattr(llm_service, "_http_post", boom)
    with pytest.raises(LLMServiceError):
        llm_service.generate_answer("soru", [_chunk()])


def test_non_200_status_raises_llm_service_error(monkeypatch):
    monkeypatch.setattr(
        llm_service, "_http_post",
        lambda path, payload: _FakeResponse(500, text="iç sunucu hatası"),
    )
    with pytest.raises(LLMServiceError):
        llm_service.generate_answer("soru", [_chunk()])


def test_malformed_response_raises_llm_service_error(monkeypatch):
    monkeypatch.setattr(
        llm_service, "_http_post",
        lambda path, payload: _FakeResponse(200, {"unexpected": "shape"}),
    )
    with pytest.raises(LLMServiceError):
        llm_service.generate_answer("soru", [_chunk()])


def test_non_json_body_raises_llm_service_error(monkeypatch):
    # 200 dönen ama gövdesi JSON olmayan yanıt (ör. proxy'nin HTML hata sayfası):
    # response.json() ValueError fırlatır. Bu, kontrolsüz 500 yerine kullanıcıya
    # gösterilebilir LLMServiceError'a (503) çevrilmelidir.
    class _BadJson(_FakeResponse):
        def json(self):
            raise ValueError("gövde geçerli JSON değil")

    monkeypatch.setattr(
        llm_service, "_http_post",
        lambda path, payload: _BadJson(200, text="<html>502 Bad Gateway</html>"),
    )
    with pytest.raises(LLMServiceError):
        llm_service.generate_answer("soru", [_chunk()])


def test_empty_content_raises_llm_service_error(monkeypatch):
    monkeypatch.setattr(
        llm_service, "_http_post",
        lambda path, payload: _FakeResponse(200, _ok_payload("   ")),
    )
    with pytest.raises(LLMServiceError):
        llm_service.generate_answer("soru", [_chunk()])
