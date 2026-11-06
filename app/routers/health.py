from fastapi import APIRouter, Depends, status
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db

router = APIRouter(tags=["Health"])


@router.get("/health", summary="Kiểm tra trạng thái server và kết nối CSDL")
async def health_check(db: AsyncSession = Depends(get_db)):
    """
    Kiểm tra trạng thái server và kết nối CSDL PostgreSQL bằng SQLAlchemy AsyncSession.
    """
    try:
        await db.execute(text("SELECT 1"))
        return {
            "status": "ok",
            "database": "connected",
        }
    except Exception:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "status": "error",
                "database": "disconnected",
                "detail": "Database connection failed",
            },
        )
