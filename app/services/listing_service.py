"""
Listing Service (SDD 4, TE9C735, UC-02, UC-03, UC-04, FR-03, FR-07, BR-01..BR-03, TC-04, TC-07).
Handles listings query by map bounding box, detail retrieval, rank calculation, and business rules.
"""

import math
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.repositories.listing_repository import ListingRepository
from app.schemas.listing import ListingMapItem, ListingDetailResponse, PhotoItem
from app.services.score_calculator import ScoreCalculator
from app.core.exceptions import BadRequestException, NotFoundException

DISTRICT_COORDINATES: Dict[str, Tuple[float, float]] = {
    "Quận 1": (10.7756, 106.7004),
    "Quận 3": (10.7844, 106.6844),
    "Quận 4": (10.7578, 106.7013),
    "Quận 5": (10.7540, 106.6634),
    "Quận 6": (10.7481, 106.6352),
    "Quận 7": (10.7340, 106.7218),
    "Quận 8": (10.7241, 106.6286),
    "Quận 10": (10.7716, 106.6669),
    "Quận 11": (10.7629, 106.6500),
    "Quận 12": (10.8672, 106.6414),
    "Bình Thạnh": (10.8106, 106.7091),
    "Phú Nhuận": (10.7992, 106.6803),
    "Gò Vấp": (10.8387, 106.6653),
    "Tân Bình": (10.8015, 106.6526),
    "Tân Phú": (10.7901, 106.6280),
    "Bình Tân": (10.7653, 106.6039),
    "Thủ Đức": (10.8494, 106.7537),
}


class ListingService:
    """Service xử lý nghiệp vụ tìm kiếm, hiển thị tin đăng trên bản đồ và chi tiết tin."""

    MAX_KEYWORD_LENGTH = 100
    MAX_LISTINGS_LIMIT = 50

    def __init__(self, listing_repo: Optional[ListingRepository] = None):
        self.listing_repo = listing_repo or ListingRepository()

    @classmethod
    def validate_keyword(cls, q: Optional[str]) -> Optional[str]:
        """
        Kiểm tra tính hợp lệ của từ khóa tìm kiếm q (UC-03 E1, FR-05).
        Ngoại lệ: Ném BadRequestException (400) nếu độ dài vượt quá 100 ký tự.
        """
        if q is None:
            return None

        if len(q) > cls.MAX_KEYWORD_LENGTH:
            raise BadRequestException(
                message="Từ khóa tìm kiếm không được vượt quá 100 ký tự",
                fields={"q": f"Từ khóa tìm kiếm tối đa {cls.MAX_KEYWORD_LENGTH} ký tự"},
            )

        cleaned = q.strip()
        return cleaned if cleaned else None

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

    @staticmethod
    def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        """Tính khoảng cách đường chim bay (km) giữa 2 tọa độ theo công thức Haversine."""
        r = 6371.0
        dlat = math.radians(lat2 - lat1)
        dlon = math.radians(lon2 - lon1)
        a = (
            math.sin(dlat / 2) ** 2
            + math.cos(math.radians(lat1))
            * math.cos(math.radians(lat2))
            * math.sin(dlon / 2) ** 2
        )
        c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
        return round(r * c, 2)

    async def get_listings(
        self,
        db: AsyncSession,
        bbox: Optional[str] = None,
        q: Optional[str] = None,
        category_id: Optional[int] = None,
        min_score: Optional[float] = None,
        district: Optional[str] = None,
        lat: Optional[float] = None,
        lng: Optional[float] = None,
        radius: Optional[float] = None,
        sort: Optional[str] = "distance",
        limit: int = 50,
    ) -> List[ListingMapItem]:
        """
        Lấy danh sách tin đăng trên bản đồ / tìm kiếm theo từ khóa và bộ lọc:
          - Từ khóa q tối đa 100 ký tự (trả 400 nếu vượt quá).
          - Bán kính radius từ 1 đến 20 km (trả 400 nếu ngoài khoảng).
          - Hỗ trợ lọc theo danh mục, khu vực, điểm tối thiểu, bán kính.
          - Sắp xếp theo khoảng cách (distance), điểm (score) hoặc mới nhất (newest).
          - Tối đa 50 tin mỗi lần gọi.
        """
        keyword = self.validate_keyword(q)
        safe_limit = min(max(1, limit), self.MAX_LISTINGS_LIMIT)

        # Kiểm tra tính hợp lệ của bán kính
        if radius is not None and (radius < 1.0 or radius > 20.0):
            raise BadRequestException(
                message="Bán kính tìm kiếm phải nằm trong khoảng từ 1 đến 20 km",
                fields={"radius": "Bán kính ngoài khoảng 1–20 km"},
            )

        # Xác định tọa độ tâm để tính khoảng cách
        center_coords: Optional[Tuple[float, float]] = None
        if lat is not None and lng is not None:
            if not (-90.0 <= lat <= 90.0):
                raise BadRequestException(
                    message="Vĩ độ lat phải nằm trong khoảng [-90, 90]",
                    fields={"lat": "Vĩ độ ngoài phạm vi [-90, 90]"},
                )
            if not (-180.0 <= lng <= 180.0):
                raise BadRequestException(
                    message="Kinh độ lng phải nằm trong khoảng [-180, 180]",
                    fields={"lng": "Kinh độ ngoài phạm vi [-180, 180]"},
                )
            center_coords = (lat, lng)
        elif district and district in DISTRICT_COORDINATES:
            center_coords = DISTRICT_COORDINATES[district]

        if radius is not None and center_coords is None:
            raise BadRequestException(
                message="Cần cung cấp tọa độ hoặc khu vực để lọc theo bán kính",
                fields={"radius": "Thiếu tọa độ gốc"},
            )

        # Truy vấn CSDL
        if bbox is not None:
            min_lng, min_lat, max_lng, max_lat = self.parse_bbox(bbox)
            listings = await self.listing_repo.find_in_bounds(
                db,
                min_lng=min_lng,
                min_lat=min_lat,
                max_lng=max_lng,
                max_lat=max_lat,
                q=keyword,
                category_id=category_id,
                min_score=min_score,
                district=district,
                limit=safe_limit,
            )
        elif radius is not None and center_coords is not None:
            # Lọc thô bằng bounding box xung quanh bán kính
            c_lat, c_lng = center_coords
            lat_delta = radius / 111.0
            lng_delta = radius / max(1.0, 111.0 * math.cos(math.radians(c_lat)))
            min_lat = max(-90.0, c_lat - lat_delta)
            max_lat = min(90.0, c_lat + lat_delta)
            min_lng = max(-180.0, c_lng - lng_delta)
            max_lng = min(180.0, c_lng + lng_delta)

            listings = await self.listing_repo.find_in_bounds(
                db,
                min_lng=min_lng,
                min_lat=min_lat,
                max_lng=max_lng,
                max_lat=max_lat,
                q=keyword,
                category_id=category_id,
                min_score=min_score,
                district=district,
                limit=100,  # Lấy dư để lọc chính xác bằng Haversine
            )
        else:
            listings = await self.listing_repo.find_selling(
                db,
                q=keyword,
                category_id=category_id,
                min_score=min_score,
                district=district,
                limit=safe_limit,
            )

        result: List[ListingMapItem] = []
        for item in listings:
            total_score_val = float(item.total_score)
            rank_label = ScoreCalculator.get_rank(total_score_val)

            item_dist: Optional[float] = None
            if center_coords is not None:
                item_dist = self.calculate_distance(
                    center_coords[0], center_coords[1], float(item.lat), float(item.lng)
                )

            # Lọc theo bán kính chính xác (Haversine) nếu có yêu cầu
            if radius is not None and item_dist is not None and item_dist > radius:
                continue

            thumb_url = (
                item.photos[0].url
                if hasattr(item, "photos") and item.photos and len(item.photos) > 0
                else None
            )
            cat_name = (
                item.category.name
                if hasattr(item, "category") and item.category
                else None
            )

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
                    category_name=cat_name,
                    thumbnail_url=thumb_url,
                    address=item.address,
                    distance=item_dist,
                    created_at=item.created_at,
                )
            )

        # Sắp xếp kết quả
        if sort == "distance" and center_coords is not None:
            result.sort(key=lambda x: x.distance if x.distance is not None else float("inf"))
        elif sort == "score":
            result.sort(key=lambda x: x.total_score, reverse=True)
        elif sort == "newest":
            result.sort(
                key=lambda x: x.created_at or datetime.min.replace(tzinfo=timezone.utc),
                reverse=True,
            )

        return result[:safe_limit]

    async def get_listing_detail(
        self,
        db: AsyncSession,
        listing_id: int,
        current_user: Optional[User] = None,
    ) -> ListingDetailResponse:
        """
        Lấy chi tiết tin đăng (UC-04, FR-07, TC-04):
          - Trả về thông tin đầy đủ, danh mục, người bán, điểm thành phần và điểm tổng.
          - Sắp xếp ảnh theo sort_order (BR-04).
          - Tin đã bán, đã ẩn, bị từ chối hoặc không tồn tại: Trả 404 'Tin không còn hiển thị'.
          - Trường phone chỉ hiển thị khi đã đăng nhập (current_user có giá trị).
        """
        listing = await self.listing_repo.find_by_id_with_relations(db, listing_id)
        if not listing:
            raise NotFoundException(message="Tin không còn hiển thị")

        # Kiểm tra quyền xem tin nếu tin không ở trạng thái 'selling'
        if listing.status != "selling":
            is_authorized = (
                current_user is not None
                and (current_user.user_id == listing.seller_id or current_user.role == "admin")
            )
            if not is_authorized:
                raise NotFoundException(message="Tin không còn hiển thị")

        # TC-04: SĐT người bán chỉ trả về khi người dùng đã đăng nhập hợp lệ
        phone = listing.seller.phone if (current_user and listing.seller) else None
        seller_name = listing.seller.full_name if listing.seller else "Người bán EcoFind"
        category_name = listing.category.name if listing.category else None

        # Sắp xếp ảnh theo thứ tự sort_order
        photos = [
            PhotoItem(id=p.photo_id, url=p.url, sort_order=p.sort_order)
            for p in sorted(listing.photos, key=lambda x: x.sort_order)
        ]

        total_score_val = float(listing.total_score)
        rank_label = ScoreCalculator.get_rank(total_score_val)

        return ListingDetailResponse(
            id=listing.listing_id,
            seller_id=listing.seller_id,
            seller_name=seller_name,
            phone=phone,
            category_id=listing.category_id,
            category_name=category_name,
            title=listing.title,
            description=listing.description,
            price=float(listing.price),
            address=listing.address,
            lat=float(listing.lat),
            lng=float(listing.lng),
            score_appearance=float(listing.score_appearance),
            score_function=float(listing.score_function),
            score_accessories=float(listing.score_accessories),
            total_score=total_score_val,
            rank=rank_label,
            status=listing.status,
            photos=photos,
            created_at=listing.created_at,
        )
