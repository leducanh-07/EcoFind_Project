"""
Listings Router (SDD 4, SDD 7.2, UC-02, UC-03, FR-03).
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.listing import ListingMapItem
from app.services.listing_service import ListingService

router = APIRouter(prefix="/listings", tags=["Listings"])
listing_service = ListingService()


@router.get(
    "",
    response_model=List[ListingMapItem],
    status_code=status.HTTP_200_OK,
    summary="Lấy danh sách tin đăng theo khung nhìn bản đồ (UC-02, FR-03)",
)
async def get_listings(
    bbox: Optional[str] = Query(
        None,
        description="Khung nhìn bản đồ phân cách bằng dấu phẩy: minLng,minLat,maxLng,maxLat (ví dụ: 106.6,10.7,106.8,10.9)",
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
    Lấy các tin đăng đang bán (status = 'selling') trong khung nhìn bản đồ:
      - Trả tối đa 50 tin gồm id, title, price, lat, lng, totalScore, rank (FR-03).
      - Chỉ tin status = 'selling' (BR-03).
      - Tin pending không bao giờ xuất hiện (TC-07).
      - Tham số bbox sai định dạng trả HTTP 400.
    """
    return await listing_service.get_listings(db, bbox=bbox, limit=limit)

