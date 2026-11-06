from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from sqlalchemy.ext.asyncio import (
    create_async_engine,
    AsyncSession,
    async_sessionmaker,
)
from app.core.config import settings

Base = declarative_base()

# -----------------------------------------------------------------------------
# 1. Sync Engine & Session (Dùng cho scripts, migrations hoặc task đồng bộ)
# -----------------------------------------------------------------------------
_engine = None
_SessionLocal = None


def get_engine():
    global _engine
    if _engine is None:
        _engine = create_engine(
            settings.database_url,
            pool_pre_ping=True,
            echo=settings.DEBUG,
        )
    return _engine


def get_session_local():
    global _SessionLocal
    if _SessionLocal is None:
        _SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=get_engine(),
        )
    return _SessionLocal


# -----------------------------------------------------------------------------
# 2. Async Engine & Session (Dùng cho FastAPI AsyncSession)
# -----------------------------------------------------------------------------
_async_engine = None
_AsyncSessionLocal = None


def get_async_engine():
    global _async_engine
    if _async_engine is None:
        _async_engine = create_async_engine(
            settings.async_database_url,
            pool_pre_ping=True,
            echo=settings.DEBUG,
        )
    return _async_engine


def get_async_session_local():
    global _AsyncSessionLocal
    if _AsyncSessionLocal is None:
        _AsyncSessionLocal = async_sessionmaker(
            bind=get_async_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _AsyncSessionLocal


async def get_db():
    """
    FastAPI dependency cung cấp AsyncSession.
    """
    session_factory = get_async_session_local()
    async with session_factory() as session:
      try:
          yield session
      finally:
          await session.close()


def __getattr__(name: str):
    """Hỗ trợ import trực tiếp engine, SessionLocal hoặc async tương đương."""
    if name == "engine":
        return get_engine()
    if name == "SessionLocal":
        return get_session_local()
    if name == "async_engine":
        return get_async_engine()
    if name == "AsyncSessionLocal":
        return get_async_session_local()
    raise AttributeError(f"module '{__name__}' has no attribute '{name}'")
