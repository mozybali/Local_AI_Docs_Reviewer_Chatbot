"""Soru-Cevap (RAG) endpoint'i (Hafta 4).

`POST /chat/ask`: Giriş yapmış kullanıcının sorusunu alır, yalnızca kendi
dokümanları içinde top-k anlamsal arama yapar (retrieval) ve bulunan parçaları
bağlam olarak lokal LLM'e vererek kaynaklı bir cevap üretir.

Akış (README "Temel Çalışma Akışı — Soru-Cevap"):
1. Retrieval kullanıcının `user_id` değeriyle sınırlandırılır (izolasyon).
2. Hiç bağlam bulunamazsa LLM hiç çağrılmadan standart "bulunamadı" cevabı döner.
3. Aksi halde LLM yalnızca getirilen chunk'lara dayanarak cevap üretir.
4. Cevapla birlikte kaynak listesi (doküman adı, sayfa, skor, chunk index) döner.

Hata yönetimi tek noktada toplanır: embedding/vektör/LLM alt servis hataları
kullanıcıya anlaşılır mesajlarla `503` olarak döner.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services import llm_service, retrieval_service
from app.services.embedding_service import EmbeddingError
from app.services.llm_service import LLMServiceError
from app.services.vector_store import VectorStoreError
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/chat", tags=["chat"])


# --- Şemalar -------------------------------------------------------------


class ChatRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    document_ids: list[int] | None = None
    top_k: int = Field(default=5, ge=1, le=20)


class ChatSource(BaseModel):
    document: str
    page: int | None
    chunk_index: int
    score: float
    text: str


class ChatResponse(BaseModel):
    answer: str
    sources: list[ChatSource]


# --- Endpoint ------------------------------------------------------------


@router.post("/ask", response_model=ChatResponse)
def ask(
    payload: ChatRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> ChatResponse:
    """Retrieval + lokal LLM ile kaynaklı cevap üretir (kullanıcı bazlı)."""
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
        answer = llm_service.generate_answer(payload.question, chunks)
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
