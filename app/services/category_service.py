"""
Category Service (SDD 4, UC-03).
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.category_repository import CategoryRepository
from app.schemas.category import CategoryResponse


class CategoryService:
    """Service xử lý nghiệp vụ liên quan đến danh mục sản phẩm."""

    def __init__(self, category_repo: Optional[CategoryRepository] = None):
        self.category_repo = category_repo or CategoryRepository()

    async def list_categories(self, db: AsyncSession) -> List[CategoryResponse]:
        """Lấy danh sách tất cả danh mục sản phẩm."""
        categories = await self.category_repo.list_all(db)
        return [
            CategoryResponse(
                id=c.category_id,
                name=c.name,
                category_id=c.category_id,
            )
            for c in categories
        ]

