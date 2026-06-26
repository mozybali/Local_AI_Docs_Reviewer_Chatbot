"""FastAPI uygulama giriş noktası.

- CORS frontend için yapılandırılır.
- Veritabanı şeması Alembic migration'ları ile yönetilir (bkz. `migrations/`).
  Uygulamayı başlatmadan önce `alembic upgrade head` çalıştırılmalıdır.
- Uygulama başlangıcında yalnızca ilk admin kullanıcı (seed) eklenir.
- Router'lar: `auth`, `documents` (Hafta 1-2), `search` (Hafta 3).
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  -- tüm ORM mapper'larını (User/Document/Chunk) kaydeder
from app.config import settings
from app.routers import auth, documents, search
from app.seed import seed_admin_user

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Uygulama yaşam döngüsü: ilk admin kullanıcıyı seed eder.

    Şema oluşturma/güncelleme artık Alembic'in sorumluluğundadır; başlangıçta
    `create_all` çağrılmaz. Tablolar yoksa `alembic upgrade head` çalıştırın.
    """
    seed_admin_user()
    logger.info("Başlangıç hazır.")
    yield


app = FastAPI(
    title="LocalDoc AI",
    description="Lokal AI destekli doküman soru-cevap sistemi (RAG).",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(search.router)


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    """Basit sağlık kontrolü."""
    return {"status": "ok"}


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    """Kök endpoint."""
    return {"name": "LocalDoc AI", "version": "0.1.0", "docs": "/docs"}
