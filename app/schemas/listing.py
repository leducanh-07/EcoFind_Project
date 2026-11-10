"""
Pydantic Schemas for Listings (SDD 6.1, 7.2, UC-02, UC-03, BR-01..BR-03).
"""

from typing import Optional, List
from datetime import datetime
from app.schemas.health import BaseSchema


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

