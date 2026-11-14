"""
Listings Router
"""

from typing import List, Optional
from fastapi import APIRouter, Depends, Form, File, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.core.dependencies import get_current_user, get_optional_user
from app.models.user import User
from app.schemas.listing import ListingMapItem, ListingDetailResponse, ListingCreateResponse
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


@router.post(
    "",
    response_model=ListingCreateResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Đăng tin bán đồ cũ kèm ảnh và điểm tự chấm",
)
async def create_listing(
    title: Optional[str] = Form(None),
    category_id: Optional[int] = Form(None),
    categoryId: Optional[int] = Form(None),
    price: Optional[float] = Form(None),
    description: Optional[str] = Form(None),
    address: Optional[str] = Form(None),
    lat: Optional[float] = Form(None),
    lng: Optional[float] = Form(None),
    score_appearance: Optional[float] = Form(None),
    scoreAppearance: Optional[float] = Form(None),
    score_function: Optional[float] = Form(None),
    scoreFunction: Optional[float] = Form(None),
    score_accessories: Optional[float] = Form(None),
    scoreAccessories: Optional[float] = Form(None),
    photos: List[UploadFile] = File([]),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Đăng tin bán đồ cũ:
      - Nhận multipart/form-data: title, categoryId, price, description, lat, lng, address, 1-5 ảnh, 3 điểm thành phần.
      - Chặn trường bắt buộc, giá 0-1.000.000.000, điểm 0-10.
      - Server tính lại điểm tổng bằng ScoreCalculator và bỏ qua giá trị client.
      - Lưu status = 'pending' (chưa hiện trên bản đồ).
      - Trả 201 kèm id, status, totalScore, rank, message = 'Đã gửi, chờ duyệt'.
    """
    effective_category_id = category_id if category_id is not None else categoryId
    effective_score_appearance = score_appearance if score_appearance is not None else scoreAppearance
    effective_score_function = score_function if score_function is not None else scoreFunction
    effective_score_accessories = score_accessories if score_accessories is not None else scoreAccessories

    return await listing_service.create_listing(
        db,
        seller=current_user,
        title=title,
        category_id=effective_category_id,
        price=price,
        description=description,
        address=address,
        lat=lat,
        lng=lng,
        score_appearance=effective_score_appearance,
        score_function=effective_score_function,
        score_accessories=effective_score_accessories,
        photos=photos,
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
    Xem chi tiết tin đăng theo ID:
      - Trả về ảnh (theo sort_order), giá, mô tả, địa chỉ, người bán, 3 điểm thành phần, điểm tổng, hạng.
      - Trường phone chỉ xuất hiện khi có token xác thực hợp lệ.
      - Tin đã bán, đã ẩn, không tồn tại trả 404 'Tin không còn hiển thị'.
    """
    return await listing_service.get_listing_detail(db, listing_id=id, current_user=current_user)
