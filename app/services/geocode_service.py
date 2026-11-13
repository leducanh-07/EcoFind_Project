"""
Geocode Service (UC-05, FR-08, NFR-MNT-01, UC-05 A1).
Orchestrates geocoding requests via GeocodeAdapter.
"""

from typing import Optional, Tuple
from app.adapters.geocode_adapter import BaseGeocodeAdapter, default_geocode_adapter
from app.core.exceptions import BadRequestException, NotFoundException


class GeocodeService:
    """
    Dịch vụ xử lý nghiệp vụ tra cứu tọa độ từ địa chỉ.
    Bảo đảm tuân thủ NFR-MNT-01: độc lập với nhà cung cấp bản đồ nhờ adapter.
    """

    def __init__(self, adapter: Optional[BaseGeocodeAdapter] = None):
        self.adapter = adapter or default_geocode_adapter

    async def get_coordinates(self, address: Optional[str]) -> Tuple[float, float]:
        """
        Tra cứu tọa độ (lat, lng) cho địa chỉ người dùng cung cấp.
        Ném BadRequestException nếu địa chỉ rỗng hoặc quá dài.
        Ném NotFoundException nếu nhà cung cấp không tìm thấy tọa độ phù hợp.
        """
        cleaned = (address or "").strip()
        if not cleaned:
            raise BadRequestException(
                message="Địa chỉ không được để trống",
                fields={"address": "Vui lòng nhập địa chỉ"},
            )

        if len(cleaned) > 255:
            raise BadRequestException(
                message="Địa chỉ không được vượt quá 255 ký tự",
                fields={"address": "Địa chỉ quá dài (tối đa 255 ký tự)"},
            )

        coords = await self.adapter.geocode(cleaned)
        if not coords:
            raise NotFoundException(message="Không tìm thấy tọa độ cho địa chỉ này")

        return coords
