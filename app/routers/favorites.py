"""
Favorites Router (/api/favorites)
"""

from typing import List
from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.favorite import FavoriteItemResponse
from app.services.favorite_service import favorite_service

router = APIRouter(prefix="/favorites", tags=["Favorites"])


@router.get(
    "",
    response_model=List[FavoriteItemResponse],
    status_code=status.HTTP_200_OK,
    summary="Lấy danh sách tin yêu thích của người dùng",
)
async def get_favorites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy danh sách tin yêu thích của người dùng hiện tại:
      - Tin đã bán hoặc bị ẩn gắn nhãn 'Không còn bán'.
    """
    return await favorite_service.get_user_favorites(db, user_id=current_user.user_id)


@router.post(
    "/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Thêm tin vào danh sách yêu thích",
)
async def add_favorite_alias(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Thêm tin vào danh sách yêu thích.
    """
    await favorite_service.add_favorite(db, user_id=current_user.user_id, listing_id=listing_id)


@router.delete(
    "/{listing_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Xóa tin khỏi danh sách yêu thích",
)
async def delete_favorite_alias(
    listing_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Xóa tin khỏi danh sách yêu thích.
    """
    await favorite_service.remove_favorite(db, user_id=current_user.user_id, listing_id=listing_id)
