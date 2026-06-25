"""FastAPI uygulama giriş noktası.

- CORS frontend için yapılandırılır.
- Uygulama başlangıcında veritabanı tabloları oluşturulur ve ilk admin
  kullanıcı (seed) eklenir.
- 1. Hafta router'ları: `auth`, `documents`.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  -- ORM tablolarını Base.metadata'ya kaydeder
from app.config import settings
from app.database import Base, engine
from app.routers import auth, documents
from app.seed import seed_admin_user

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Uygulama yaşam döngüsü: başlangıçta tablo oluşturma + admin seed."""
    logger.info("Veritabanı tabloları oluşturuluyor...")
    Base.metadata.create_all(bind=engine)
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


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    """Basit sağlık kontrolü."""
    return {"status": "ok"}


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    """Kök endpoint."""
    return {"name": "LocalDoc AI", "version": "0.1.0", "docs": "/docs"}
