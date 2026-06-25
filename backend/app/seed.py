"""İlk admin kullanıcıyı (seed) oluşturur.

Uygulama ilk kez başlatıldığında `.env` içindeki `DEFAULT_ADMIN_EMAIL` ve
`DEFAULT_ADMIN_PASSWORD` değerleriyle bir `admin` kullanıcı oluşturulur.
Kullanıcı zaten varsa hiçbir şey yapılmaz (idempotent).
"""

import logging

from app.config import settings
from app.database import SessionLocal
from app.services.auth_service import create_user, get_user_by_email

logger = logging.getLogger(__name__)


def seed_admin_user() -> None:
    """Varsayılan admin kullanıcı yoksa oluşturur."""
    db = SessionLocal()
    try:
        existing = get_user_by_email(db, settings.DEFAULT_ADMIN_EMAIL)
        if existing is not None:
            logger.info(
                "Admin kullanıcı zaten mevcut: %s", settings.DEFAULT_ADMIN_EMAIL
            )
            return

        create_user(
            db,
            email=settings.DEFAULT_ADMIN_EMAIL,
            password=settings.DEFAULT_ADMIN_PASSWORD,
            role="admin",
            is_active=True,
        )
        logger.info(
            "İlk admin kullanıcı oluşturuldu: %s", settings.DEFAULT_ADMIN_EMAIL
        )
    finally:
        db.close()
