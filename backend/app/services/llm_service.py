"""Lokal LLM servisi (Hafta 4).

Retrieval ile bulunan doküman parçalarını bağlam olarak alıp lokal çalışan bir
LLM'den (LM Studio, OpenAI uyumlu `/v1/chat/completions` API'si) kaynaklı ve
kontrollü bir cevap üretir.

Tasarım ilkeleri:
- **Sıkı RAG:** Model yalnızca verilen bağlama dayanır; bağlam yoksa hiç LLM
  çağrısı yapılmadan standart "bulunamadı" cevabı döner. Böylece model boş
  bağlamda bilgi uyduramaz (hallucination önlemi).
- **Açık hata yönetimi:** LLM sunucusuna ulaşılamazsa kullanıcıya anlaşılır bir
  mesaj (`LLMServiceError`) iletilir; ham bağlantı hatası sızdırılmaz.
- **Sağlayıcıdan bağımsız:** LM Studio OpenAI uyumlu bir API sunduğundan istek
  standart `chat/completions` şemasıyla yapılır. Aynı kod, OpenAI uyumlu başka
  bir lokal sunucuyla (örn. Ollama'nın OpenAI uçları) da çalışır.

Konfigürasyon `.env` üzerinden okunur (`LLM_API_URL`, `LLM_MODEL_NAME`,
`LLM_TEMPERATURE`, `LLM_MAX_TOKENS`, `LLM_TIMEOUT`).
"""

from __future__ import annotations

import logging
import re
from typing import TYPE_CHECKING

import httpx

from app.config import settings

if TYPE_CHECKING:  # pragma: no cover - yalnızca tip denetimi için
    from app.services.retrieval_service import RetrievedChunk

logger = logging.getLogger(__name__)

# Bağlamda cevap yoksa dönülecek standart yanıt. RAG prompt'taki kuralla birebir
# aynı olmalıdır; hem boş retrieval kısa devresinde hem de model bu metni
# döndürdüğünde tutarlı bir çıktı sağlar.
NO_ANSWER = "Bu bilgi yüklenen dokümanda bulunamadı."

# Kullanıcıya gösterilecek hata mesajları (README "Güvenlik ve Dosya Doğrulama").
_LLM_DOWN_MESSAGE = (
    "Lokal AI modeli çalışmıyor. LM Studio local server'ını başlatın."
)
_LLM_BAD_RESPONSE_MESSAGE = "Lokal AI modelinden geçerli bir cevap alınamadı."

# RAG prompt şablonu (README "RAG Prompt Şablonu"). Sistem mesajı kuralları,
# kullanıcı mesajı ise bağlam + soruyu taşır.
_SYSTEM_PROMPT = (
    "Sen lokal çalışan bir doküman soru-cevap asistanısın.\n\n"
    "Kurallar:\n"
    "1. Sadece aşağıdaki bağlamı kullan.\n"
    "2. Bağlamda olmayan bilgiyi ekleme.\n"
    "3. Emin değilsen tahmin yapma.\n"
    "4. Cevabı Türkçe ve açık şekilde ver.\n"
    "5. Cevabın sonuna kaynak listesi (\"Kaynaklar\", \"[Kaynak 1]\" vb.) "
    "EKLEME; kaynaklar kullanıcıya uygulama tarafından ayrıca gösterilir.\n"
    "6. Bağlamda cevap yoksa yalnızca şunu yaz:\n"
    f'   "{NO_ANSWER}"'
)

# Modelin (kurala rağmen) cevabın sonuna eklediği kaynak/kaynakça bölümünü
# yakalar. Başlık kendi satırında, isteğe bağlı markdown (** ## > -) ve ":" ile
# başlar; o satırdan metin sonuna kadar her şey kaynak listesidir. Kaynaklar
# arayüzde ayrı bir panelde (SourcePanel) gösterildiğinden cevap metnindeki bu
# tekrar gereksizdir ve yer kaplar.
_SOURCES_SECTION_RE = re.compile(
    r"(?is)\n[ \t]*[*_#>\-]*[ \t]*kaynak(?:lar|ça)?[ \t]*[*_]*[ \t]*:.*\Z"
)


class LLMServiceError(Exception):
    """Lokal LLM ile iletişim sırasında oluşan, kullanıcıya gösterilebilir hata.

    `str(exc)` doğrudan kullanıcıya gösterilebilecek Türkçe bir mesaj içerir.
    """


def generate_answer(question: str, chunks: list["RetrievedChunk"]) -> str:
    """Retrieval sonuçlarına dayanarak lokal LLM'den cevap üretir.

    - Bağlam (`chunks`) boşsa LLM hiç çağrılmaz ve standart `NO_ANSWER` döner.
      Bu, hem gereksiz isteği önler hem de boş bağlamda hallucination'ı keser.
    - Aksi halde RAG prompt'u oluşturulup lokal LLM'e gönderilir.

    LLM'e ulaşılamazsa `LLMServiceError` fırlatır.
    """
    if not chunks:
        return NO_ANSWER

    messages = build_messages(question, chunks)
    answer = _chat_completion(messages)
    answer = _strip_sources_section(answer)
    return answer.strip() or NO_ANSWER


def _strip_sources_section(answer: str) -> str:
    """Cevabın sonundaki "Kaynaklar:" bölümünü ayıklar.

    Prompt modelden kaynak listesi istemez (kural #5); ancak lokal modeller
    talimatı atlayıp cevabın sonuna kaynak listesi ekleyebilir. Kaynaklar zaten
    arayüzde ayrı bir panelde gösterildiğinden bu tekrarı savunmacı olarak
    temizleriz. Başlık metnin en başındaysa (öncesinde içerik yoksa) hiçbir şey
    silinmez; böylece geçerli bir cevap yanlışlıkla boşaltılmaz.
    """
    cleaned = _SOURCES_SECTION_RE.sub("", answer).strip()
    return cleaned or answer.strip()


def build_messages(
    question: str, chunks: list["RetrievedChunk"]
) -> list[dict[str, str]]:
    """RAG için OpenAI uyumlu `messages` listesini oluşturur.

    Sistem mesajı kuralları, kullanıcı mesajı ise numaralı kaynaklarla bağlamı ve
    soruyu içerir. Kaynaklar etiketlenir (dosya adı + sayfa) ki model cevabını
    doğru parçaya dayandırabilsin; ancak bu etiketleri cevaba geri yazmaz
    (kaynaklar arayüzde ayrı gösterilir, bkz. kural #5).
    """
    context = _format_context(chunks)
    user_content = f"Bağlam:\n{context}\n\nSoru:\n{question}\n\nCevap:"
    return [
        {"role": "system", "content": _SYSTEM_PROMPT},
        {"role": "user", "content": user_content},
    ]


def _format_context(chunks: list["RetrievedChunk"]) -> str:
    """Retrieval parçalarını kaynak etiketli, numaralı bir bağlam metnine çevirir."""
    parts: list[str] = []
    for index, chunk in enumerate(chunks, start=1):
        page = f", sayfa {chunk.page}" if chunk.page is not None else ""
        parts.append(
            f"[Kaynak {index}] {chunk.document}{page}:\n{chunk.text}"
        )
    return "\n\n".join(parts)


def _chat_completion(messages: list[dict[str, str]]) -> str:
    """Lokal LLM'in `chat/completions` ucuna istek atar ve cevabı döner.

    Bağlantı/zaman aşımı hatalarını ve geçersiz yanıtları `LLMServiceError`'a
    çevirir; çağıran taraf ham `httpx` hatalarıyla uğraşmak zorunda kalmaz.
    """
    payload = {
        "model": settings.LLM_MODEL_NAME,
        "messages": messages,
        "temperature": settings.LLM_TEMPERATURE,
        "max_tokens": settings.LLM_MAX_TOKENS,
        "stream": False,
    }

    try:
        response = _http_post("/chat/completions", payload)
    except httpx.HTTPError as exc:
        # ConnectError, TimeoutException, ReadError vb. hepsi httpx.HTTPError'dan
        # türer: kullanıcıya tek ve anlaşılır bir mesaj göster.
        logger.warning("Lokal LLM'e ulaşılamadı: %s", exc)
        raise LLMServiceError(_LLM_DOWN_MESSAGE) from exc

    if response.status_code != httpx.codes.OK:
        logger.warning(
            "Lokal LLM beklenmeyen durum kodu döndü: %s — %s",
            response.status_code,
            response.text[:500],
        )
        raise LLMServiceError(_LLM_DOWN_MESSAGE)

    # 200 dönse bile gövde geçerli JSON olmayabilir (ör. proxy HTML hata sayfası
    # ya da boş gövde). `response.json()` bu durumda `ValueError`
    # (`json.JSONDecodeError`) fırlatır; bu httpx.HTTPError değildir ve aşağıdaki
    # `_extract_content` da yalnızca KeyError/IndexError/TypeError yakalar. Burada
    # yakalamazsak hata router'a kadar sızıp kontrolsüz 500 döner; kullanıcıya
    # gösterilebilir bir LLMServiceError'a (503) çeviriyoruz.
    try:
        data = response.json()
    except ValueError as exc:
        logger.warning(
            "Lokal LLM JSON olmayan gövde döndürdü: %s", response.text[:500]
        )
        raise LLMServiceError(_LLM_BAD_RESPONSE_MESSAGE) from exc

    return _extract_content(data)


def _http_post(path: str, payload: dict) -> httpx.Response:
    """LLM API'sine POST isteği atar (testlerde monkeypatch edilebilir sınır).

    `LLM_API_URL` zaten `/v1` ile biter; `path` ona eklenir.
    """
    url = f"{settings.LLM_API_URL.rstrip('/')}{path}"
    with httpx.Client(timeout=settings.LLM_TIMEOUT) as client:
        return client.post(url, json=payload)


def _extract_content(data: dict) -> str:
    """OpenAI uyumlu yanıttan cevap metnini güvenli şekilde çıkarır."""
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        logger.warning("Lokal LLM yanıtı beklenen şemada değil: %r", data)
        raise LLMServiceError(_LLM_BAD_RESPONSE_MESSAGE) from exc

    if not isinstance(content, str) or not content.strip():
        raise LLMServiceError(_LLM_BAD_RESPONSE_MESSAGE)
    return content


def check_health() -> bool:
    """Lokal LLM sunucusunun ayakta olup olmadığını hafifçe yoklar.

    `/models` ucuna kısa zaman aşımıyla GET atar. Bağlantı kurulabiliyorsa
    `True`, aksi halde `False` döner (istisna fırlatmaz). Teşhis amaçlıdır.
    """
    url = f"{settings.LLM_API_URL.rstrip('/')}/models"
    try:
        with httpx.Client(timeout=5) as client:
            response = client.get(url)
        return response.status_code == httpx.codes.OK
    except httpx.HTTPError:
        return False
