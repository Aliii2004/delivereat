import asyncio
import os
from logging.config import fileConfig

from sqlalchemy import pool
from sqlalchemy.engine import Connection
from sqlalchemy.ext.asyncio import async_engine_from_config

from alembic import context

# alembic.ini logging konfiguratsiyasi
config = context.config
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Barcha modellarni import qilish — migration larda ko'rinishi uchun
from app.database import Base  # noqa: F401
from app.models.order_event import OrderEvent       # noqa: F401
from app.models.delivery_metric import DeliveryMetric  # noqa: F401
from app.models.restaurant_stat import RestaurantStat  # noqa: F401

target_metadata = Base.metadata

# DATABASE_URL ni environment dan olish
# alembic.ini da bo'sh qoldirilgan — env var ishlatiladi
def get_url() -> str:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise ValueError("DATABASE_URL environment variable is not set")
    return url


def run_migrations_offline() -> None:
    url = get_url()
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_async_migrations() -> None:
    # MUHIM: SQLAlchemy 2.0 async bilan Alembic
    # async_engine_from_config ishlatilishi shart
    # Oddiy create_engine ishlamaydi
    configuration = config.get_section(config.config_ini_section, {})
    configuration["sqlalchemy.url"] = get_url()

    connectable = async_engine_from_config(
        configuration,
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    async with connectable.connect() as connection:
        await connection.run_sync(do_run_migrations)

    await connectable.dispose()


def run_migrations_online() -> None:
    asyncio.run(run_async_migrations())


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
