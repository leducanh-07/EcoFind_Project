"""
Categories Router
"""

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.category import CategoryResponse
from app.services.category_service import CategoryService

router = APIRouter(prefix="/categories", tags=["Categories"])
category_service = CategoryService()


@router.get(
    "",
    response_model=List[CategoryResponse],
    status_code=status.HTTP_200_OK,
    summary="Lấy danh sách danh mục sản phẩm",
)
async def list_categories(
    db: AsyncSession = Depends(get_db),
):
    """
    Trả về danh sách tất cả danh mục hàng hóa (nội thất, điện tử, sách, quần áo...).
    Dùng cho các bộ lọc trên bản đồ và form đăng tin.
    Endpoint mở cho mọi người (không cần đăng nhập).
    """
    return await category_service.list_categories(db)

