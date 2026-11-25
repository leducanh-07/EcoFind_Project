"""
Public User / Seller Profile Router (/api/users)
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.user import PublicSellerProfileResponse
from app.services.user_service import user_service

router = APIRouter(prefix="/users", tags=["Users"])


@router.get(
    "/{user_id}/profile",
    response_model=PublicSellerProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Xem hồ sơ công khai, vai trò và danh sách tin đang bán của người dùng",
)
async def get_public_seller_profile(
    user_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Lấy trang cá nhân công khai của người bán theo user_id (không lộ email/SĐT)."""
    return await user_service.get_public_seller_profile(db, user_id=user_id)
