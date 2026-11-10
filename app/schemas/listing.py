"""
Pydantic Schemas for Listings (SDD 6.1, 7.2, UC-02, UC-03, UC-04, BR-01..BR-03, FR-07).
"""

from typing import Optional, List
from datetime import datetime
from app.schemas.health import BaseSchema


class PhotoItem(BaseSchema):
    """Schema thông tin ảnh tin đăng."""
    id: int
    url: str
    sort_order: int = 0


class ListingMapItem(BaseSchema):
    """
    Schema cho tin đăng hiển thị trên bản đồ (UC-02, FR-03).
    Bao gồm các trường cốt lõi theo SDD 7.2:
    id, title, price, lat, lng, totalScore, rank.
    """
    id: int
    title: str
    price: float
    lat: float
    lng: float
    total_score: float
    rank: str
    status: str
    category_id: Optional[int] = None
    address: Optional[str] = None
    created_at: Optional[datetime] = None


class ListingDetailResponse(BaseSchema):
    """
    Schema chi tiết tin đăng (UC-04, FR-07, SDD 7.2).
    Trả về ảnh (theo sort_order), giá, mô tả, địa chỉ, người bán, 3 điểm thành phần, điểm tổng, hạng.
    Trường phone chỉ xuất hiện khi người gọi đã đăng nhập (TC-04).
    """
    id: int
    seller_id: int
    seller_name: str
    phone: Optional[str] = None
    category_id: int
    category_name: Optional[str] = None
    title: str
    description: str
    price: float
    address: str
    lat: float
    lng: float
    score_appearance: float
    score_function: float
    score_accessories: float
    total_score: float
    rank: str
    status: str
    photos: List[PhotoItem] = []
    created_at: Optional[datetime] = None
