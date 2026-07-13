"""Alembic 마이그레이션 환경.

- URL 은 settings.DATABASE_URL 을 make_sync_url() 로 변환해 주입한다.
- 모든 SQLModel 모델을 import 하여 target_metadata 를 채운다 (--autogenerate 정확도).
"""

from logging.config import fileConfig

from alembic import context
from sqlalchemy import engine_from_config, pool
from sqlmodel import SQLModel

from expense_api.core.config.settings import settings
from expense_api.core.db.migrations import make_sync_url

# 모든 모델을 로드 → SQLModel.metadata 에 테이블 등록
import expense_api.core.models  # noqa: F401

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 런타임 URL 주입 (async → sync 변환)
config.set_main_option("sqlalchemy.url", make_sync_url(settings.DATABASE_URL))

target_metadata = SQLModel.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        compare_type=True,
        compare_server_default=True,
        render_as_batch=url.startswith("sqlite"),  # SQLite ALTER 제약 우회
    )
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        is_sqlite = connection.dialect.name == "sqlite"
        context.configure(
            connection=connection,
            target_metadata=target_metadata,
            compare_type=True,
            compare_server_default=True,
            render_as_batch=is_sqlite,  # SQLite ALTER 제약 우회
        )
        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
