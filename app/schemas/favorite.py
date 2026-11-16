"""
Pydantic Schemas for Favorite listings (SDD 6.1, 7.2, UC-07, FR-11).
"""

from typing import Optional
from datetime import datetime
from app.schemas.health import BaseSchema


class FavoriteItemResponse(BaseSchema):
    """
    Schema tin yêu thích trong danh sách (UC-07, FR-11, E2).
    Tin đã bán hoặc bị ẩn có nhãn 'Không còn bán' (E2).
    """
    id: int
    listing_id: int
    title: str
    price: float
    address: Optional[str] = None
    lat: Optional[float] = None
    lng: Optional[float] = None
    category_id: Optional[int] = None
    category_name: Optional[str] = None
    total_score: float
    rank: str
    status: str
    is_available: bool = True
    status_label: Optional[str] = None
    thumbnail_url: Optional[str] = None
    favorited_at: Optional[datetime] = None


class FavoriteStatusResponse(BaseSchema):
    """Schema kiểm tra trạng thái đã lưu / yêu thích của tin."""
    listing_id: int
    is_favorite: bool
