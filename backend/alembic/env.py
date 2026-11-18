from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool

from app.core.config import settings
from app.db.base import Base
from app.db import models  # noqa: F401 - register ORM tables with metadata

config = context.config
config.set_main_option("sqlalchemy.url", settings.database_url.replace("%", "%%"))
if config.config_file_name is not None:
    fileConfig(config.config_file_name)
target_metadata = Base.metadata


def run_migrations_offline() -> None:
    context.configure(
        url=settings.database_url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    import os
    from sqlalchemy import create_engine

    # Read URL directly from env and strip whitespace/CRLF (Windows .env files
    # have \r\n line endings which corrupt the URL and cause SQLAlchemy to
    # fall back to the psycopg2 driver instead of psycopg3).
    db_url = os.environ.get("DATABASE_URL", settings.database_url).strip()

    # Ensure the psycopg3 driver is specified (project installs 'psycopg', not 'psycopg2')
    if db_url.startswith("postgresql://"):
        db_url = "postgresql+psycopg" + db_url[len("postgresql"):]

    connectable = create_engine(db_url, poolclass=pool.NullPool)
    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata, compare_type=True)
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
