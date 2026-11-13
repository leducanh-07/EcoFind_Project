"""
Pydantic Schemas for Geocoding (UC-05, FR-08, SDD 7.2).
"""

from app.schemas.health import BaseSchema


class GeocodeResponse(BaseSchema):
    """
    Schema phản hồi tọa độ địa lý từ địa chỉ (GET /api/geocode).
    Trả về vĩ độ (lat) và kinh độ (lng) theo SDD 7.2.
    """
    lat: float
    lng: float
