"""Alembic ortam yapılandırması.

Veritabanı URL'i ve hedef metadata, uygulamanın kendi konfigürasyonundan
(`app.config.settings`) ve ORM modellerinden (`app.database.Base`) okunur.
Böylece migration'lar her zaman uygulama ile aynı şema tanımını kullanır ve
`--autogenerate` doğru çalışır.
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.config import settings
from app.database import Base

# Tüm modelleri import ederek tablo tanımlarını Base.metadata'ya kaydet.
# (app.models.__init__ -> User, Document, Chunk)
import app.models  # noqa: F401,E402

# Alembic .ini yapılandırması.
config = context.config

# .env'deki DATABASE_URL'i Alembic'e aktar (alembic.ini'de boş bırakıldı).
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

# Logging yapılandırması.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Autogenerate'in karşılaştıracağı hedef şema.
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    """'Offline' mod: DB bağlantısı olmadan SQL üretir (`--sql`)."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    """'Online' mod: gerçek bağlantı üzerinden migration uygular."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
        )

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
