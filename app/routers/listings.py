"""
Listings Router (SDD 4, SDD 7.2, TE9C735, TE9C737, UC-02, UC-03, UC-04, FR-03, FR-05, FR-07).
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_optional_user
from app.models.user import User
from app.schemas.listing import ListingMapItem, ListingDetailResponse
from app.services.listing_service import ListingService

router = APIRouter(prefix="/listings", tags=["Listings"])
listing_service = ListingService()


@router.get(
    "",
    response_model=List[ListingMapItem],
    status_code=status.HTTP_200_OK,
    summary="Lấy danh sách tin đăng theo khung nhìn bản đồ và từ khóa",
)
async def get_listings(
    bbox: Optional[str] = Query(
        None,
        description="Khung nhìn bản đồ phân cách bằng dấu phẩy: minLng,minLat,maxLng,maxLat (ví dụ: 106.6,10.7,106.8,10.9)",
    ),
    q: Optional[str] = Query(
        None,
        description="Từ khóa tìm kiếm trên tiêu đề và mô tả (tối đa 100 ký tự, không phân biệt hoa thường)",
    ),
    limit: int = Query(
        50,
        ge=1,
        le=50,
        description="Số lượng tin tối đa trả về (tối đa 50 tin theo SDD 7.2)",
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy các tin đăng đang bán (status = 'selling') trong khung nhìn bản đồ và/hoặc tìm kiếm theo từ khóa:
      - Tìm ILIKE trên title và description, không phân biệt hoa thường (FR-05).
      - Từ khóa q dài quá 100 ký tự trả HTTP 400 (UC-03 E1).
      - Trả tối đa 50 tin gồm id, title, price, lat, lng, totalScore, rank (FR-03, FR-05).
      - Chỉ tin status = 'selling' (BR-03).
      - Tin pending/sold/hidden không bao giờ xuất hiện (TC-07).
      - Tham số bbox sai định dạng trả HTTP 400.
    """
    return await listing_service.get_listings(db, bbox=bbox, q=q, limit=limit)


@router.get(
    "/{id}",
    response_model=ListingDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Xem chi tiết tin đăng",
)
async def get_listing_detail(
    id: int,
    db: AsyncSession = Depends(get_db),
    current_user: Optional[User] = Depends(get_optional_user),
):
    """
    Xem chi tiết tin đăng theo ID (TE9C735, UC-04, FR-07):
      - Trả về ảnh (theo sort_order), giá, mô tả, địa chỉ, người bán, 3 điểm thành phần, điểm tổng, hạng.
      - Trường phone chỉ xuất hiện khi có token xác thực hợp lệ (TC-04).
      - Tin đã bán, đã ẩn, không tồn tại trả 404 'Tin không còn hiển thị'.
    """
    return await listing_service.get_listing_detail(db, listing_id=id, current_user=current_user)
