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
from app.services.listing_service import ListingService

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
