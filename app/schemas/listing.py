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
    category_name: Optional[str] = None
    thumbnail_url: Optional[str] = None
    address: Optional[str] = None
    distance: Optional[float] = None
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


class ListingCreateResponse(BaseSchema):
    """
    Schema phản hồi khi đăng tin mới thành công (STT 31, 36, UC-05, FR-08, FR-09).
    Trả 201 kèm id, status ('pending'), totalScore, rank, message.
    """
    id: int
    status: str = "pending"
    total_score: float
    totalScore: Optional[float] = None
    rank: str
    message: str = "Đã gửi, chờ duyệt"


class MyListingItem(BaseSchema):
    """
    Schema danh sách tin đăng của chính người dùng (UC-06, FR-10, TE9C74C).
    Bao gồm thông tin tin đăng, phân hạng, reject_reason nếu bị từ chối và cờ hidden_by_admin.
    """
    id: int
    title: str
    description: Optional[str] = None
    price: float
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    score_appearance: Optional[float] = None
    score_function: Optional[float] = None
    score_accessories: Optional[float] = None
    total_score: float
    rank: str
    status: str
    reject_reason: Optional[str] = None
    review_note: Optional[str] = None
    hidden_by_admin: bool = False
    thumbnail_url: Optional[str] = None
    photos: List[PhotoItem] = []
    created_at: Optional[datetime] = None
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None


class ListingUpdateRequest(BaseSchema):
    """Schema cập nhật tin đăng của người bán."""
    title: Optional[str] = None
    category_id: Optional[int] = None
    price: Optional[float] = None
    description: Optional[str] = None
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    score_appearance: Optional[float] = None
    score_function: Optional[float] = None
    score_accessories: Optional[float] = None
    photos: Optional[List[str]] = None


class ListingStatusUpdateRequest(BaseSchema):
    """Schema cập nhật trạng thái tin đăng (ẩn, hiện lại, đã bán)."""
    status: str



