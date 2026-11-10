"""
Repository for Category entity access (SDD 4, SDD 6.1).
Uses SQLAlchemy 2.0 AsyncSession.
"""

from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.category import Category


class CategoryRepository:
    """Repository chuyên trách truy vấn bảng categories."""

    async def list_all(self, db: AsyncSession) -> List[Category]:
        """Lấy toàn bộ danh sách danh mục."""
        stmt = select(Category).order_by(Category.category_id.asc())
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def find_by_id(self, db: AsyncSession, category_id: int) -> Optional[Category]:
        """Tìm danh mục theo ID."""
        stmt = select(Category).where(Category.category_id == category_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_by_name(self, db: AsyncSession, name: str) -> Optional[Category]:
        """Tìm danh mục theo tên."""
        stmt = select(Category).where(Category.name == name.strip())
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

