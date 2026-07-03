"""Sohbet endpoint'leri (Hafta 4 + Hafta 6).

`POST /chat/ask`: Giriş yapmış kullanıcının sorusunu alır, yalnızca kendi
dokümanları içinde top-k anlamsal arama yapar (retrieval) ve bulunan parçaları
bağlam olarak lokal LLM'e vererek kaynaklı bir cevap üretir.

`GET /chat/models` (Hafta 6): Kullanıcının seçebileceği (sunucu tarafı
allowlist'teki) modelleri döner. Context window gibi üretim parametreleri
istemciye düzenlenebilir alan olarak açılmaz; yalnızca `model_id` seçilir.

`POST /chat/general` (Hafta 6): RAG/doküman bağı olmayan normal sohbet.
Yalnızca `user`/`assistant` rolleri kabul edilir; sistem mesajı backend
tarafından eklenir. Retrieval yapılmaz, kaynak dönülmez.

Akış (README "Temel Çalışma Akışı — Soru-Cevap"):
1. Retrieval kullanıcının `user_id` değeriyle sınırlandırılır (izolasyon).
2. Hiç bağlam bulunamazsa LLM hiç çağrılmadan standart "bulunamadı" cevabı döner.
3. Aksi halde LLM yalnızca getirilen chunk'lara dayanarak cevap üretir.
4. Cevapla birlikte kaynak listesi (doküman adı, sayfa, skor, chunk index) döner.

Ortak güvenlik davranışı:
- Tüm uçlar auth ister (401/403 `get_current_user` üzerinden).
- Chat uçları kullanıcı + IP + mod bazında rate limit'lidir (429).
- İstemciden gelen `model_id` allowlist'e göre doğrulanır; geçersizse 400.
- `extra="forbid"`: context_window gibi sunucu tarafı alanlar istekte kabul
  edilmez (422).
- Loglara kullanıcı mesajı içeriği yazılmaz; yalnızca uzunluk/model/mod loglanır.

Hata yönetimi tek noktada toplanır: embedding/vektör/LLM alt servis hataları
kullanıcıya anlaşılır mesajlarla `503` olarak döner.
"""

import logging
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.models.user import User
from app.services import llm_service, model_registry, retrieval_service
from app.services.embedding_service import EmbeddingError
from app.services.llm_service import LLMServiceError
from app.services.model_registry import ModelNotAllowedError
from app.services.vector_store import VectorStoreError
from app.utils.dependencies import enforce_user_rate_limit, get_current_user

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])


def _enforce_chat_rate_limit(request: Request, user_id: int, mode: str) -> None:
    """Chat uçları için kullanıcı + IP + mod bazlı rate limit uygular.

    Anahtar mod'a göre ayrışır (`chat:rag` / `chat:general`); RAG kullanımı
    normal sohbeti (ya da tersini) kilitlemez. Limit aşımında `429` döner.
    Kontrol + kayıt tek adımda (atomik) yapılır.
    """
    enforce_user_rate_limit(
        request,
        user_id,
        scope=f"chat:{mode}",
        attempts=settings.CHAT_RATE_LIMIT_ATTEMPTS,
        window_seconds=settings.CHAT_RATE_LIMIT_WINDOW_SECONDS,
    )


def _resolve_model(
    user: User, model_id: str | None, mode: str
) -> model_registry.ModelConfig:
    """İstemcinin model seçimini allowlist'e göre doğrular; geçersizse 400."""
    try:
        return model_registry.resolve_allowed_model(user, model_id, mode)
    except ModelNotAllowedError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        )


# --- Şemalar -------------------------------------------------------------
# `extra="forbid"`: istemci yalnızca tanımlı alanları gönderebilir. Özellikle
# context_window / max_tokens / temperature gibi üretim parametreleri istekte
# KABUL EDİLMEZ; bunlar yalnızca sunucu tarafı model tanımından gelir.
# `protected_namespaces=()`: pydantic'in `model_` öneki uyarısını kapatır
# (`model_id` alanı bilinçli bir isimlendirmedir).


class ChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", protected_namespaces=())

    question: str = Field(min_length=1, max_length=2000)
    document_ids: list[int] | None = None
    top_k: int = Field(default=8, ge=1, le=20)
    # Opsiyonel model seçimi; boşsa RAG modunun varsayılan modeli kullanılır.
    model_id: str | None = Field(default=None, max_length=200)


class ChatSource(BaseModel):
    document: str
    page: int | None
    chunk_index: int
    score: float
    text: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[ChatSource]


class ModelInfo(BaseModel):
    model_config = ConfigDict(protected_namespaces=())

    id: str
    label: str
    modes: list[str]
    is_default: bool


class GeneralChatMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # Yalnızca user/assistant kabul edilir; system/developer rolü istemciden
    # gelemez (backend kendi sistem mesajını ekler) -> aksi halde 422.
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=16000)


class GeneralChatRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", protected_namespaces=())

    model_id: str | None = Field(default=None, max_length=200)
    messages: list[GeneralChatMessage] = Field(min_length=1, max_length=100)

    @model_validator(mode="after")
    def last_message_from_user(self) -> "GeneralChatRequest":
        """Cevap üretilecek son mesajın kullanıcıya ait olmasını şart koşar."""
        if self.messages[-1].role != "user":
            raise ValueError("Son mesaj kullanıcıya ait olmalıdır.")
        return self


class GeneralChatResponse(BaseModel):
    answer: str


# --- Endpoint'ler ----------------------------------------------------------


@router.get("/models", response_model=list[ModelInfo])
def list_models(
    mode: Literal["rag", "general"] | None = None,
    current_user: User = Depends(get_current_user),
) -> list[ModelInfo]:
    """Kullanıcının seçebileceği modelleri döner (Hafta 6).

    `mode` verilirse yalnızca o modu destekleyen modeller listelenir; listedeki
    ilk model o modun varsayılanıdır (`is_default`). context_window ve diğer
    üretim parametreleri bilinçli olarak DÖNÜLMEZ: istemci bu değerleri ne
    görür ne de değiştirebilir; bütçe sunucu tarafında uygulanır.
    """
    if mode is not None:
        models = model_registry.get_available_models_for_user(current_user, mode)
    else:
        models = [m for m in model_registry.get_allowed_models() if m.enabled]
    default = models[0] if models else None
    return [
        ModelInfo(
            id=model.id,
            label=model.label,
            modes=list(model.modes),
            is_default=model is default,
        )
        for model in models
    ]


@router.post("/ask", response_model=ChatResponse)
def ask(
    payload: ChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    """Retrieval + lokal LLM ile kaynaklı cevap üretir (kullanıcı bazlı)."""
    _enforce_chat_rate_limit(request, current_user.id, "rag")
    model = _resolve_model(current_user, payload.model_id, "rag")

    # İçerik loglanmaz; teşhis için uzunluk/model/mod yeterlidir.
    logger.info(
        "chat/ask: user_id=%s model=%s soru_uzunlugu=%s",
        current_user.id,
        model.id,
        len(payload.question),
    )

    # 1) Retrieval — yalnızca kullanıcının kendi `ready` dokümanları içinde.
    try:
        chunks = retrieval_service.search_chunks(
            db=db,
            user_id=current_user.id,
            question=payload.question,
            document_ids=payload.document_ids,
            top_k=payload.top_k,
        )
    except EmbeddingError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Embedding modeli yüklenemedi. Lütfen tekrar deneyin.",
        )
    except VectorStoreError:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Vektör veritabanına ulaşılamadı. Lütfen tekrar deneyin.",
        )

    # 2) LLM cevabı — bağlam boşsa servis hiç LLM çağırmadan standart yanıt döner.
    try:
        answer = llm_service.generate_answer(
            payload.question, chunks, model_config=model
        )
    except LLMServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )

    # 3) Kaynaklar — bağlam boşsa kaynak da gösterilmez.
    sources = [
        ChatSource(
            document=chunk.document,
            page=chunk.page,
            chunk_index=chunk.chunk_index,
            score=chunk.score,
            text=chunk.text,
        )
        for chunk in chunks
    ]

    return ChatResponse(answer=answer, sources=sources)


@router.post("/general", response_model=GeneralChatResponse)
def general_chat(
    payload: GeneralChatRequest,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> GeneralChatResponse:
    """RAG/doküman bağı olmayan normal sohbet cevabı üretir (Hafta 6).

    Retrieval yapılmaz ve kaynak dönülmez. Sistem mesajı backend tarafından
    eklenir; istemciden yalnızca `user`/`assistant` geçmişi kabul edilir.
    """
    _enforce_chat_rate_limit(request, current_user.id, "general")
    model = _resolve_model(current_user, payload.model_id, "general")

    logger.info(
        "chat/general: user_id=%s model=%s mesaj_sayisi=%s",
        current_user.id,
        model.id,
        len(payload.messages),
    )

    messages = [
        {"role": message.role, "content": message.content}
        for message in payload.messages
    ]
    try:
        answer = llm_service.generate_general_chat(messages, model_config=model)
    except LLMServiceError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        )

    return GeneralChatResponse(answer=answer)
