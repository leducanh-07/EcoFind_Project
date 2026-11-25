"""
Pydantic Schemas for Geocoding (UC-05, FR-08, SDD 7.2).
"""

from typing import List, Optional
from pydantic import Field
from app.schemas.health import BaseSchema


class GeocodeResponse(BaseSchema):
    """
    Schema phản hồi tọa độ địa lý từ địa chỉ (GET /api/geocode).
    Luôn trả về vĩ độ (lat) và kinh độ (lng) theo SDD 7.2,
    đồng thời bổ sung thông tin độ chính xác và địa chỉ khớp được.
    """
    lat: float
    lng: float
    matched_address: Optional[str] = None
    accuracy: Optional[str] = None
    provider: Optional[str] = None


class GeocodeSuggestion(BaseSchema):
    """Một mục gợi ý địa chỉ cho Autocomplete (GET /api/geocode/suggest)."""
    text: str
    magic_key: Optional[str] = None


class GeocodeSuggestResponse(BaseSchema):
    """Danh sách gợi ý địa chỉ trả về cho dropdown Autocomplete."""
    suggestions: List[GeocodeSuggestion] = Field(default_factory=list)


class ReverseGeocodeResponse(BaseSchema):
    """Địa chỉ văn bản tương ứng với tọa độ GPS (GET /api/geocode/reverse)."""
    address: str
