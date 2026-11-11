"""
Listing Service (SDD 4, TE9C735, UC-02, UC-03, UC-04, FR-03, FR-07, BR-01..BR-03, TC-04, TC-07).
Handles listings query by map bounding box, detail retrieval, rank calculation, and business rules.
"""

from typing import List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.user import User
from app.repositories.listing_repository import ListingRepository
from app.schemas.listing import ListingMapItem, ListingDetailResponse, PhotoItem
from app.services.score_calculator import ScoreCalculator
from app.core.exceptions import BadRequestException, NotFoundException


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

    async def get_listings(
        self,
        db: AsyncSession,
        bbox: Optional[str] = None,
        q: Optional[str] = None,
        limit: int = 50,
    ) -> List[ListingMapItem]:
        """
        Lấy danh sách tin đăng trên bản đồ / tìm kiếm theo từ khóa (UC-02, UC-03, FR-03, FR-05):
          - Từ khóa q dài quá 100 ký tự trả lỗi 400 (UC-03 E1).
          - Giới hạn tối đa 50 tin mỗi lần gọi.
          - Chỉ lấy các tin có trạng thái 'selling' (Đang bán) (BR-03, TC-07).
          - Tin 'pending', 'sold', 'rejected', 'hidden' tuyệt đối không xuất hiện.
          - Tự động gán hạng tình trạng (rank) theo chuẩn BR-02 qua ScoreCalculator.
        """
        keyword = self.validate_keyword(q)
        safe_limit = min(max(1, limit), self.MAX_LISTINGS_LIMIT)

        if bbox is not None:
            min_lng, min_lat, max_lng, max_lat = self.parse_bbox(bbox)
            listings = await self.listing_repo.find_in_bounds(
                db, min_lng, min_lat, max_lng, max_lat, q=keyword, limit=safe_limit
            )
        else:
            listings = await self.listing_repo.find_selling(
                db, q=keyword, limit=safe_limit
            )

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
