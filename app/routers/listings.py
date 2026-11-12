"""
Listings Router
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
    summary="Lấy danh sách tin đăng theo khung nhìn bản đồ, từ khóa và bộ lọc",
)
async def get_listings(
    bbox: Optional[str] = Query(
        None,
        description="Khung nhìn bản đồ phân cách bằng dấu phẩy: minLng,minLat,maxLng,maxLat",
    ),
    q: Optional[str] = Query(
        None,
        description="Từ khóa tìm kiếm trên tiêu đề và mô tả (tối đa 100 ký tự)",
    ),
    category: Optional[str] = Query(
        None,
        description="Lọc theo ID hoặc tên danh mục sản phẩm",
    ),
    category_id: Optional[int] = Query(
        None,
        description="Lọc theo mã danh mục sản phẩm",
    ),
    min_score: Optional[float] = Query(
        None,
        ge=0.0,
        le=10.0,
        description="Lọc theo điểm tình trạng tối thiểu (0.0 - 10.0)",
    ),
    minScore: Optional[float] = Query(
        None,
        ge=0.0,
        le=10.0,
        include_in_schema=False,
    ),
    district: Optional[str] = Query(
        None,
        description="Lọc theo tên quận/huyện",
    ),
    lat: Optional[float] = Query(
        None,
        ge=-90.0,
        le=90.0,
        description="Vĩ độ tâm vị trí để tính khoảng cách",
    ),
    lng: Optional[float] = Query(
        None,
        ge=-180.0,
        le=180.0,
        description="Kinh độ tâm vị trí để tính khoảng cách",
    ),
    radius: Optional[float] = Query(
        None,
        description="Bán kính tìm kiếm (1 - 20 km)",
    ),
    sort: Optional[str] = Query(
        "distance",
        description="Tiêu chuẩn sắp xếp: distance (gần nhất), score (điểm cao nhất), newest (mới nhất)",
    ),
    limit: int = Query(
        50,
        ge=1,
        le=50,
        description="Số lượng tin tối đa trả về",
    ),
    db: AsyncSession = Depends(get_db),
):
    """
    Lấy các tin đăng đang bán (status = 'selling') kết hợp tìm kiếm và lọc:
      - Hỗ trợ lọc theo từ khóa q trên tiêu đề và mô tả (tối đa 100 ký tự).
      - Hỗ trợ lọc theo danh mục (category / category_id), khu vực quận/huyện (district), điểm tối thiểu.
      - Hỗ trợ lọc theo bán kính từ 1 đến 20 km (lọc thô lat/lng + Haversine) và tính khoảng cách (distance).
      - Sắp xếp linh hoạt theo khoảng cách, điểm tình trạng hoặc mới nhất.
      - Trả tối đa 50 tin mỗi lần gọi.
    """
    effective_min_score = min_score if min_score is not None else minScore
    return await listing_service.get_listings(
        db,
        bbox=bbox,
        q=q,
        category=category,
        category_id=category_id,
        min_score=effective_min_score,
        district=district,
        lat=lat,
        lng=lng,
        radius=radius,
        sort=sort,
        limit=limit,
    )


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
