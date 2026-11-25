"""
Router for User Account and Personal Listings (/api/me)
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.exceptions import BadRequestException
from app.models.user import User
from app.schemas.listing import MyListingItem
from app.schemas.favorite import FavoriteItemResponse
from app.schemas.user import ChangePasswordRequest, MyProfileResponse, ProfileUpdateRequest
from app.services.listing_service import ListingService
from app.services.favorite_service import favorite_service
from app.services.user_service import user_service

router = APIRouter(prefix="/me", tags=["My Listings"])
listing_service = ListingService()

VALID_STATUSES = {"pending", "selling", "rejected", "sold", "hidden"}


@router.get(
    "/listings",
    response_model=List[MyListingItem],
    status_code=status.HTTP_200_OK,
    summary="Xem tất cả tin của chính người dùng theo từng trạng thái",
)
async def get_my_listings(
    status_filter: Optional[str] = Query(
        None,
        alias="status",
        description="Lọc theo trạng thái tin đăng: pending, selling, rejected, sold, hidden",
    ),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy danh sách tin của người bán theo từng trạng thái:
      - Chỉ trả về tin của chính người dùng đăng nhập (seller_id = current_user.user_id).
      - Tận dụng chỉ mục idx_listings_seller trên cột seller_id.
      - Trả về kèm reject_reason nếu tin bị từ chối và cờ hidden_by_admin.
      - Hỗ trợ lọc status: pending, selling, rejected, sold, hidden.
      - Nếu không truyền status hoặc status rỗng: trả về tất cả tin của người dùng.
    """
    clean_status = None
    if status_filter is not None:
        stripped = status_filter.strip().lower()
        if stripped:
            if stripped not in VALID_STATUSES:
                raise BadRequestException(
                    message=f"Trạng thái '{status_filter}' không hợp lệ. Các trạng thái hợp lệ: pending, selling, rejected, sold, hidden",
                    fields={"status": f"Chấp nhận: {', '.join(sorted(VALID_STATUSES))}"},
                )
            clean_status = stripped

    return await listing_service.get_my_listings(
        db,
        seller_id=current_user.user_id,
        status=clean_status,
    )


@router.get(
    "/favorites",
    response_model=List[FavoriteItemResponse],
    status_code=status.HTTP_200_OK,
    summary="Xem danh sách tin đã lưu yêu thích của người dùng",
)
async def get_my_favorites(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy danh sách các tin đăng mà người dùng đã lưu:
      - Tin đã bán hoặc bị ẩn gắn nhãn 'Không còn bán'.
      - Sắp xếp theo thứ tự lưu mới nhất.
    """
    return await favorite_service.get_user_favorites(db, user_id=current_user.user_id)


@router.get(
    "/profile",
    response_model=MyProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Xem thông tin trang cá nhân của tài khoản đang đăng nhập",
)
async def get_my_profile(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Trả về thông tin cá nhân, vai trò/giới thiệu và thống kê hoạt động của chính người dùng."""
    return await user_service.get_my_profile(db, user=current_user)


@router.put(
    "/profile",
    response_model=MyProfileResponse,
    status_code=status.HTTP_200_OK,
    summary="Cập nhật họ tên và số điện thoại cá nhân",
)
async def update_my_profile(
    payload: ProfileUpdateRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Cập nhật họ tên và số điện thoại của chính người dùng."""
    return await user_service.update_my_profile(db, user=current_user, payload=payload)


@router.put(
    "/password",
    status_code=status.HTTP_200_OK,
    summary="Đổi mật khẩu cho tài khoản đang đăng nhập",
)
async def change_my_password(
    payload: ChangePasswordRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Đổi mật khẩu (áp dụng cho cả tài khoản thành viên và quản trị viên)."""
    return await user_service.change_password(db, user=current_user, payload=payload)

