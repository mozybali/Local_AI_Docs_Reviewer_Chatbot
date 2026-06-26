"""Semantik arama endpoint'i (Hafta 3).

`POST /search`: Giriş yapmış kullanıcının sorusunu embedding'e çevirir ve
yalnızca kendi dokümanları içinde top-k anlamsal arama yapar. Her sonuç skor,
doküman adı, sayfa numarası ve chunk index içerir.

Kullanıcı izolasyonu retrieval servisi ve ChromaDB `user_id` filtresiyle
sağlanır; bir kullanıcının araması asla başka kullanıcının chunk'larını
döndürmez.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.services import retrieval_service
from app.services.embedding_service import EmbeddingError
from app.services.vector_store import VectorStoreError
from app.utils.dependencies import get_current_user

router = APIRouter(prefix="/search", tags=["search"])


# --- Şemalar -------------------------------------------------------------


class SearchRequest(BaseModel):
    question: str = Field(min_length=1, max_length=2000)
    document_ids: list[int] | None = None
    top_k: int = Field(default=5, ge=1, le=20)


class SearchResultItem(BaseModel):
    text: str
    score: float
    document_id: int
    document: str
    page: int | None
    chunk_index: int


class SearchResponse(BaseModel):
    results: list[SearchResultItem]


# --- Endpoint ------------------------------------------------------------


@router.post("", response_model=SearchResponse)
def semantic_search(
    payload: SearchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> SearchResponse:
    """Kullanıcının dokümanları içinde top-k anlamsal arama yapar."""
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

    return SearchResponse(
        results=[
            SearchResultItem(
                text=chunk.text,
                score=chunk.score,
                document_id=chunk.document_id,
                document=chunk.document,
                page=chunk.page,
                chunk_index=chunk.chunk_index,
            )
            for chunk in chunks
        ]
    )
