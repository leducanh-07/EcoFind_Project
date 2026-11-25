"""
Geocoding Router.
Endpoints:
  - GET /api/geocode?address=...&magic_key=...
  - GET /api/geocode/suggest?q=...&limit=...
  - GET /api/geocode/reverse?lat=...&lng=...
Requires authenticated user.
"""

from typing import Optional
from fastapi import APIRouter, Depends, Query, status
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.geocode import (
    GeocodeResponse,
    GeocodeSuggestion,
    GeocodeSuggestResponse,
    ReverseGeocodeResponse,
)
from app.services.geocode_service import GeocodeService

router = APIRouter(prefix="/geocode", tags=["Geocoding"])
geocode_service = GeocodeService()


@router.get(
    "",
    response_model=GeocodeResponse,
    status_code=status.HTTP_200_OK,
    summary="Chuyển đổi địa chỉ thành tọa độ (vĩ độ, kinh độ)",
)
async def geocode_address(
    address: str = Query(..., description="Địa chỉ cần tra cứu tọa độ"),
    magic_key: Optional[str] = Query(None, description="Mã định danh gợi ý từ API suggest (nếu có)"),
    current_user: User = Depends(get_current_user),
):
    """
    Tra cứu tọa độ (lat, lng) từ chuỗi địa chỉ (hỗ trợ Google -> ArcGIS PointAddress -> Nominatim):
      - Yêu cầu đăng nhập (JWT Bearer token).
      - Trả về HTTP 200 kèm { lat, lng, matched_address, accuracy, provider }.
      - Trả về 400 nếu địa chỉ rỗng hoặc không hợp lệ.
      - Trả về 404 nếu không tìm thấy tọa độ cho địa chỉ.
    """
    result = await geocode_service.get_coordinates_detailed(address, magic_key=magic_key)
    return GeocodeResponse(
        lat=result.lat,
        lng=result.lng,
        matched_address=result.matched_address,
        accuracy=result.accuracy,
        provider=result.provider,
    )


@router.get(
    "/suggest",
    response_model=GeocodeSuggestResponse,
    status_code=status.HTTP_200_OK,
    summary="Gợi ý địa chỉ tự động khi người dùng nhập (Autocomplete)",
)
async def suggest_addresses(
    q: str = Query("", description="Từ khóa địa chỉ đang nhập"),
    limit: int = Query(5, ge=1, le=10, description="Số lượng gợi ý tối đa"),
    current_user: User = Depends(get_current_user),
):
    """Trả về tối đa `limit` gợi ý địa chỉ ưu tiên trong khu vực TP.HCM."""
    items = await geocode_service.suggest_addresses(q, limit=limit)
    return GeocodeSuggestResponse(
        suggestions=[GeocodeSuggestion(**item) for item in items]
    )


@router.get(
    "/reverse",
    response_model=ReverseGeocodeResponse,
    status_code=status.HTTP_200_OK,
    summary="Chuyển đổi ngược tọa độ GPS thành địa chỉ văn bản",
)
async def reverse_geocode(
    lat: float = Query(..., description="Vĩ độ"),
    lng: float = Query(..., description="Kinh độ"),
    current_user: User = Depends(get_current_user),
):
    """Chuyển đổi ngược tọa độ hiện tại thành chuỗi địa chỉ để điền nhanh khi ô địa chỉ trống."""
    address = await geocode_service.reverse_geocode(lat, lng)
    return ReverseGeocodeResponse(address=address)
