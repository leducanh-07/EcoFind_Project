"""
Geocode Service (UC-05, FR-08, NFR-MNT-01, UC-05 A1).
Điều phối tra cứu tọa độ, gợi ý địa chỉ (Autocomplete) và reverse geocode qua BaseGeocodeAdapter.
"""

from typing import Dict, List, Optional, Tuple
from app.adapters.geocode_adapter import (
    BaseGeocodeAdapter,
    GeocodeResult,
    default_geocode_adapter,
)
from app.core.exceptions import BadRequestException, NotFoundException


class GeocodeService:
    """
    Dịch vụ xử lý nghiệp vụ tra cứu tọa độ từ địa chỉ.
    Bảo đảm tuân thủ NFR-MNT-01: độc lập với nhà cung cấp bản đồ nhờ adapter.
    """

    def __init__(self, adapter: Optional[BaseGeocodeAdapter] = None):
        self.adapter = adapter or default_geocode_adapter

    @staticmethod
    def _validate_address(address: Optional[str]) -> str:
        """Kiểm tra tính hợp lệ của chuỗi địa chỉ đầu vào."""
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
        return cleaned

    async def get_coordinates(self, address: Optional[str]) -> Tuple[float, float]:
        """
        Tra cứu tọa độ (lat, lng) cho địa chỉ người dùng cung cấp.
        Giữ nguyên chữ ký trả về Tuple[float, float] để tương thích kiểm thử NFR-MNT-01.
        """
        result = await self.get_coordinates_detailed(address)
        return (result.lat, result.lng)

    async def get_coordinates_detailed(
        self,
        address: Optional[str],
        magic_key: Optional[str] = None,
    ) -> GeocodeResult:
        """
        Tra cứu tọa độ kèm mức độ chính xác và địa chỉ khớp được.
        Ném BadRequestException nếu địa chỉ rỗng hoặc quá dài.
        Ném NotFoundException nếu không tìm thấy tọa độ phù hợp.
        """
        cleaned = self._validate_address(address)
        result = await self.adapter.geocode_detailed(cleaned, magic_key=magic_key)
        if not result:
            raise NotFoundException(message="Không tìm thấy tọa độ cho địa chỉ này")
        return result

    async def suggest_addresses(
        self,
        query: Optional[str],
        limit: int = 5,
    ) -> List[Dict[str, Optional[str]]]:
        """Trả về danh sách gợi ý địa chỉ cho thanh Autocomplete."""
        cleaned = (query or "").strip()
        if len(cleaned) < 2 or len(cleaned) > 255:
            return []
        safe_limit = max(1, min(limit, 10))
        return await self.adapter.suggest(cleaned, limit=safe_limit)

    async def reverse_geocode(self, lat: float, lng: float) -> str:
        """Chuyển đổi ngược tọa độ GPS thành địa chỉ văn bản dễ đọc."""
        if not (-90.0 <= lat <= 90.0) or not (-180.0 <= lng <= 180.0):
            raise BadRequestException(
                message="Tọa độ không hợp lệ",
                fields={"lat": "Vĩ độ/kinh độ nằm ngoài phạm vi hợp lệ"},
            )
        address = await self.adapter.reverse(lat, lng)
        if not address:
            raise NotFoundException(message="Không xác định được địa chỉ tại tọa độ này")
        return address
