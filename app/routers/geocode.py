"""
Geocoding Router.
Endpoint: GET /api/geocode?address=...
Requires authenticated user.
"""

from fastapi import APIRouter, Depends, Query, status
from app.core.dependencies import get_current_user
from app.models.user import User
from app.schemas.geocode import GeocodeResponse
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
    current_user: User = Depends(get_current_user),
):
    """
    Tra cứu tọa độ (lat, lng) từ chuỗi địa chỉ:
      - Yêu cầu đăng nhập (cần JWT Bearer token).
      - Trả về mã HTTP 200 kèm { lat, lng }.
      - Trả về 400 nếu địa chỉ rỗng hoặc không hợp lệ.
      - Trả về 404 nếu không tìm thấy tọa độ cho địa chỉ.
      - Tuân thủ chính sách Nominatim: gửi User-Agent, không quá 1 request/giây, ưu tiên TP.HCM.
    """
    lat, lng = await geocode_service.get_coordinates(address)
    return GeocodeResponse(lat=lat, lng=lng)
