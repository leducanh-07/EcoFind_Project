"""
Listing Service (SDD 4, UC-02, FR-03, BR-01..BR-03, TC-07).
Handles listings query by map bounding box, rank calculation, and business rules.
"""

from typing import List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.listing_repository import ListingRepository
from app.schemas.listing import ListingMapItem
from app.services.score_calculator import ScoreCalculator
from app.core.exceptions import BadRequestException


class ListingService:
    """Service xử lý nghiệp vụ tìm kiếm, hiển thị tin đăng trên bản đồ."""

    def __init__(self, listing_repo: Optional[ListingRepository] = None):
        self.listing_repo = listing_repo or ListingRepository()

    @staticmethod
    def parse_bbox(bbox_str: str) -> Tuple[float, float, float, float]:
        """
        Phân tích và kiểm tra tính hợp lệ của tham số bbox (minLng,minLat,maxLng,maxLat).
        Ngoại lệ: Ném BadRequestException (400) nếu sai định dạng hoặc tọa độ ngoài phạm vi.
        """
        if not bbox_str or not isinstance(bbox_str, str):
            raise BadRequestException(
                message="Tham số bbox không được để trống",
                fields={"bbox": "Vui lòng cung cấp tham số bbox"},
            )

        parts = [p.strip() for p in bbox_str.split(",")]
        if len(parts) != 4:
            raise BadRequestException(
                message="Tham số bbox không đúng định dạng. Cú pháp chuẩn: minLng,minLat,maxLng,maxLat",
                fields={"bbox": "Yêu cầu 4 tọa độ số thực phân tách bằng dấu phẩy: minLng,minLat,maxLng,maxLat"},
            )

        try:
            min_lng = float(parts[0])
            min_lat = float(parts[1])
            max_lng = float(parts[2])
            max_lat = float(parts[3])
        except ValueError:
            raise BadRequestException(
                message="Tọa độ trong bbox phải là các số thực hợp lệ",
                fields={"bbox": "Giá trị tọa độ không phải số thực"},
            )

        # Kiểm tra phạm vi hợp lệ của vĩ độ (-90 đến 90) và kinh độ (-180 đến 180)
        if not (-90.0 <= min_lat <= 90.0 and -90.0 <= max_lat <= 90.0):
            raise BadRequestException(
                message="Vĩ độ (latitude) phải nằm trong khoảng [-90, 90]",
                fields={"bbox": "Vĩ độ ngoài phạm vi hợp lệ [-90, 90]"},
            )

        if not (-180.0 <= min_lng <= 180.0 and -180.0 <= max_lng <= 180.0):
            raise BadRequestException(
                message="Kinh độ (longitude) phải nằm trong khoảng [-180, 180]",
                fields={"bbox": "Kinh độ ngoài phạm vi hợp lệ [-180, 180]"},
            )

        if min_lat > max_lat:
            raise BadRequestException(
                message="Tọa độ minLat không thể lớn hơn maxLat",
                fields={"bbox": "minLat phải nhỏ hơn hoặc bằng maxLat"},
            )

        if min_lng > max_lng:
            raise BadRequestException(
                message="Tọa độ minLng không thể lớn hơn maxLng",
                fields={"bbox": "minLng phải nhỏ hơn hoặc bằng maxLng"},
            )

        return min_lng, min_lat, max_lng, max_lat

    async def get_listings(
        self,
        db: AsyncSession,
        bbox: Optional[str] = None,
        limit: int = 50,
    ) -> List[ListingMapItem]:
        """
        Lấy danh sách tin đăng trên bản đồ (UC-02, FR-03):
          - Giới hạn tối đa 50 tin mỗi lần gọi.
          - Chỉ lấy các tin có trạng thái 'selling' (Đang bán) (BR-03, TC-07).
          - Tin 'pending' hoặc trạng thái khác tuyệt đối không xuất hiện.
          - Tự động gán hạng tình trạng (rank) theo chuẩn BR-02 qua ScoreCalculator.
        """
        # Giới hạn an toàn tối đa 50 tin theo SDD 7.2
        safe_limit = min(max(1, limit), 50)

        if bbox is not None:
            min_lng, min_lat, max_lng, max_lat = self.parse_bbox(bbox)
            listings = await self.listing_repo.find_in_bounds(
                db, min_lng, min_lat, max_lng, max_lat, limit=safe_limit
            )
        else:
            listings = await self.listing_repo.find_selling(db, limit=safe_limit)

        result: List[ListingMapItem] = []
        for item in listings:
            total_score_val = float(item.total_score)
            rank_label = ScoreCalculator.get_rank(total_score_val)

            result.append(
                ListingMapItem(
                    id=item.listing_id,
                    title=item.title,
                    price=float(item.price),
                    lat=float(item.lat),
                    lng=float(item.lng),
                    total_score=total_score_val,
                    rank=rank_label,
                    status=item.status,
                    category_id=item.category_id,
                    address=item.address,
                    created_at=item.created_at,
                )
            )

        return result

