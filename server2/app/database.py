import os
from collections.abc import AsyncGenerator

from sqlalchemy.ext.asyncio import (
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlalchemy.orm import DeclarativeBase


# ─── DATABASE URL VALIDATION ───────────────────────────────

def get_database_url() -> str:
    url = os.environ.get("DATABASE_URL", "")
    if not url:
        raise ValueError("DATABASE_URL environment variable is not set")
    # asyncpg driver talab qilinadi
    if not url.startswith("postgresql+asyncpg://"):
        raise ValueError(
            "DATABASE_URL must use 'postgresql+asyncpg://' for async SQLAlchemy"
        )
    return url


# ─── ENGINE ────────────────────────────────────────────────

engine = create_async_engine(
    get_database_url(),
    echo=os.environ.get("NODE_ENV") != "production",  # dev da SQL log
    pool_size=10,
    max_overflow=20,
    pool_pre_ping=True,   # Connection alive ekanligini tekshiradi
    pool_recycle=3600,    # 1 soatda connection yangilanadi
)

# ─── SESSION FACTORY ───────────────────────────────────────

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# ─── BASE MODEL ────────────────────────────────────────────

class Base(DeclarativeBase):
    pass


# ─── DEPENDENCY ────────────────────────────────────────────
# FastAPI route va GraphQL resolver larda ishlatiladi

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
