"""FastAPI uygulama giriş noktası.

- CORS frontend için yapılandırılır.
- Veritabanı şeması Alembic migration'ları ile yönetilir (bkz. `migrations/`).
  Uygulamayı başlatmadan önce `alembic upgrade head` çalıştırılmalıdır.
- Uygulama başlangıcında yalnızca ilk admin kullanıcı (seed) eklenir.
- Router'lar: `auth`, `documents` (Hafta 1-2), `search` (Hafta 3),
  `chat` (Hafta 4), `admin` (Hafta 5).
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app import models  # noqa: F401  -- tüm ORM mapper'larını (User/Document/Chunk) kaydeder
from app.config import settings, validate_security_settings
from app.database import SessionLocal
from app.routers import admin, auth, chat, documents, search
from app.seed import seed_admin_user
from app.services import processing_queue
from app.services.document_service import recover_stale_documents

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Uygulama yaşam döngüsü: güvenlik kontrolü + ilk admin seed'i.

    - Güvensiz konfigürasyon (placeholder JWT secret / admin şifresi) production
      ortamında başlatmayı engeller; development'ta uyarı loglanır.
    - Şema oluşturma/güncelleme artık Alembic'in sorumluluğundadır; başlangıçta
      `create_all` çağrılmaz. Tablolar yoksa `alembic upgrade head` çalıştırın.
    - Önceki süreçte yarıda kalmış (`uploaded`/`processing`) dokümanlar `error`
      durumuna alınır; işleme kuyruğu süreç içi olduğundan bu görevler bir daha
      çalışmaz ve işaretlenmezlerse arayüzde sonsuza dek "İşleniyor" görünür.
    """
    for warning in validate_security_settings(settings):
        logger.warning("GÜVENLİK UYARISI: %s", warning)
    seed_admin_user()
    with SessionLocal() as db:
        recover_stale_documents(db)
    # Doküman işleme kuyruğunun worker'ını başlat (upload'lar seri işlenir).
    processing_queue.start_worker()
    logger.info("Başlangıç hazır.")
    yield


# Production'da OpenAPI/docs uçları kapatılır (bilgi ifşasını azaltmak için).
_docs_enabled = not settings.is_production

app = FastAPI(
    title="LocalDoc AI",
    description="Lokal AI destekli doküman soru-cevap sistemi (RAG).",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type"],
)


@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    """Tüm yanıtlara temel güvenlik başlıklarını ekler.

    API kimlik doğrulamalı ve kullanıcıya özel veri döndürdüğü için yanıtların
    ara önbelleklerde saklanmaması istenir (`Cache-Control: no-store`).
    """
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "no-referrer")
    response.headers.setdefault("Cache-Control", "no-store")
    return response

app.include_router(auth.router)
app.include_router(documents.router)
app.include_router(search.router)
app.include_router(chat.router)
app.include_router(admin.router)


@app.get("/health", tags=["system"])
def health_check() -> dict[str, str]:
    """Basit sağlık kontrolü."""
    return {"status": "ok"}


@app.get("/", tags=["system"])
def root() -> dict[str, str]:
    """Kök endpoint."""
    info = {"name": "LocalDoc AI", "version": "0.1.0"}
    if _docs_enabled:
        info["docs"] = "/docs"
    return info
