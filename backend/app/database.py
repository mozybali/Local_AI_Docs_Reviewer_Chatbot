"""Veritabanı bağlantısı ve SQLAlchemy oturum yönetimi.

PostgreSQL bağlantısı `DATABASE_URL` üzerinden kurulur. Tüm ORM modelleri
`Base` sınıfından türetilir ve FastAPI endpoint'leri `get_db` dependency'si ile
istek bazlı bir oturum (session) alır.
"""

from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    future=True,
)

SessionLocal = sessionmaker(
    bind=engine,
    autocommit=False,
    autoflush=False,
    future=True,
)


class Base(DeclarativeBase):
    """Tüm ORM modelleri için ortak taban sınıf."""


def get_db() -> Generator[Session, None, None]:
    """İstek başına bir veritabanı oturumu sağlayan FastAPI dependency'si."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
