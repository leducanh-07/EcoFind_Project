"""
Listing Service (SDD 4, SDD 6.3, TE9C735, TE9C737, TE9C738, UC-02, UC-03, UC-04, FR-03..FR-07, BR-01..BR-03, TC-04, TC-07).
Handles listings query by map bounding box, keyword, category, district, radius (Haversine), detail retrieval, and business rules.
"""

import math
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.districts import (
    HCMC_DISTRICTS,
    address_matches_district,
    get_district_search_terms,
    resolve_district,
)
from app.core.geo import bounding_box_for_radius, haversine_km
from app.models.user import User
from fastapi import UploadFile
from app.adapters.image_storage_adapter import (
    process_and_save_upload_files,
    default_image_storage_adapter,
    validate_image_file,
)
from app.repositories.category_repository import CategoryRepository
from app.repositories.listing_repository import ListingRepository
from app.schemas.listing import ListingMapItem, ListingDetailResponse, PhotoItem, ListingCreateResponse
from app.services.score_calculator import ScoreCalculator
from app.core.exceptions import BadRequestException, NotFoundException

DISTRICT_COORDINATES: Dict[str, Tuple[float, float]] = {
    info.name: (info.lat, info.lng) for info in HCMC_DISTRICTS
}


class ListingService:
    """Service xử lý nghiệp vụ tìm kiếm, hiển thị tin đăng trên bản đồ và chi tiết tin."""

    MAX_KEYWORD_LENGTH = 100
    MAX_LISTINGS_LIMIT = 50
    MIN_RADIUS_KM = 1.0
    MAX_RADIUS_KM = 20.0
    MIN_SCORE_BOUND = 0.0
    MAX_SCORE_BOUND = 10.0
    VALID_SORT_OPTIONS = ("distance", "score", "newest")

    def __init__(self, listing_repo: Optional[ListingRepository] = None):
        self.listing_repo = listing_repo or ListingRepository()

    @classmethod
    def validate_min_score(cls, min_score: Optional[float]) -> Optional[float]:
        """
        Kiểm tra điểm tình trạng tối thiểu minScore (FR-06, STT 23):
          - Giá trị hợp lệ nằm trong [0.0, 10.0]; ngoài khoảng hoặc NaN/Inf trả HTTP 400.
        """
        if min_score is None:
            return None
        if not math.isfinite(min_score) or min_score < cls.MIN_SCORE_BOUND or min_score > cls.MAX_SCORE_BOUND:
            raise BadRequestException(
                message="Điểm tình trạng tối thiểu phải nằm trong khoảng từ 0 đến 10",
                fields={"minScore": "Giá trị minScore hợp lệ từ 0.0 đến 10.0"},
            )
        return min_score

    @classmethod
    def validate_sort(cls, sort: Optional[str]) -> str:
        """
        Kiểm tra tham số sắp xếp sort (FR-06, UC-03 A1 A2, STT 23):
          - Mặc định 'distance'. Hỗ trợ 'distance', 'score', 'newest'.
          - Giá trị không hợp lệ trả HTTP 400.
        """
        if sort is None:
            return "distance"
        cleaned = sort.strip().lower()
        if not cleaned:
            return "distance"
        if cleaned not in cls.VALID_SORT_OPTIONS:
            raise BadRequestException(
                message="Tham số sắp xếp sort không hợp lệ",
                fields={"sort": "Chỉ hỗ trợ sắp xếp theo 'distance', 'score' hoặc 'newest'"},
            )
        return cleaned

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

    @classmethod
    def validate_category(
        cls,
        category: Optional[str] = None,
        category_id: Optional[int] = None,
    ) -> Tuple[Optional[int], Optional[str]]:
        """
        Phân tích tham số lọc danh mục category_id hoặc category (FR-06):
          - Hỗ trợ cả ID danh mục (category_id hoặc category='1') lẫn tên danh mục (category='Nội thất').
          - ID <= 0 trả BadRequestException (400).
        """
        if category_id is not None:
            if category_id <= 0:
                raise BadRequestException(
                    message="Tham số danh mục không hợp lệ",
                    fields={"category_id": "ID danh mục phải lớn hơn 0"},
                )
            return category_id, None

        if category is None:
            return None, None

        cleaned = category.strip()
        if not cleaned:
            return None, None

        if re.fullmatch(r"-?\d+", cleaned):
            parsed_id = int(cleaned)
            if parsed_id <= 0:
                raise BadRequestException(
                    message="Tham số danh mục không hợp lệ",
                    fields={"category": "ID danh mục phải lớn hơn 0"},
                )
            return parsed_id, None

        if len(cleaned) > cls.MAX_KEYWORD_LENGTH:
            raise BadRequestException(
                message="Tên danh mục không được vượt quá 100 ký tự",
                fields={"category": f"Tên danh mục tối đa {cls.MAX_KEYWORD_LENGTH} ký tự"},
            )
        return None, cleaned

    @classmethod
    def validate_district(cls, district: Optional[str]) -> Optional[str]:
        """Kiểm tra tham số khu vực district (FR-06)."""
        if district is None:
            return None
        if len(district) > cls.MAX_KEYWORD_LENGTH:
            raise BadRequestException(
                message="Tham số khu vực không được vượt quá 100 ký tự",
                fields={"district": f"Tên khu vực tối đa {cls.MAX_KEYWORD_LENGTH} ký tự"},
            )
        cleaned = district.strip()
        return cleaned if cleaned else None

    @classmethod
    def validate_location_and_radius(
        cls,
        lat: Optional[float],
        lng: Optional[float],
        radius: Optional[float],
        district: Optional[str],
    ) -> Tuple[Optional[float], Optional[float], Optional[float]]:
        """
        Kiểm tra tọa độ tham chiếu (lat, lng) và bán kính lọc radius (1–20 km) (FR-06, SDD 6.3, UC-03 A1):
          - radius ngoài khoảng [1, 20] -> trả HTTP 400.
          - Chỉ truyền lat hoặc chỉ truyền lng -> trả HTTP 400.
          - Nếu không truyền lat/lng nhưng chọn district có trong DISTRICT_CENTERS -> dùng tâm quận làm tham chiếu.
          - Nếu lọc radius mà không có cả (lat, lng) lẫn tâm quận -> trả HTTP 400.
        """
        if radius is not None:
            if not math.isfinite(radius) or radius < cls.MIN_RADIUS_KM or radius > cls.MAX_RADIUS_KM:
                raise BadRequestException(
                    message="Bán kính tìm kiếm phải nằm trong khoảng từ 1 đến 20 km",
                    fields={"radius": "Giá trị radius hợp lệ từ 1 đến 20 km"},
                )

        if (lat is None) != (lng is None):
            raise BadRequestException(
                message="Vui lòng cung cấp đầy đủ cả tọa độ lat và lng",
                fields={"lat": "Yêu cầu đủ cả lat và lng", "lng": "Yêu cầu đủ cả lat và lng"},
            )

        ref_lat: Optional[float] = None
        ref_lng: Optional[float] = None

        if lat is not None and lng is not None:
            if not math.isfinite(lat) or not (-90.0 <= lat <= 90.0):
                raise BadRequestException(
                    message="Vĩ độ lat phải nằm trong khoảng [-90, 90]",
                    fields={"lat": "Vĩ độ ngoài phạm vi [-90, 90]"},
                )
            if not math.isfinite(lng) or not (-180.0 <= lng <= 180.0):
                raise BadRequestException(
                    message="Kinh độ lng phải nằm trong khoảng [-180, 180]",
                    fields={"lng": "Kinh độ ngoài phạm vi [-180, 180]"},
                )
            ref_lat, ref_lng = lat, lng
        elif district:
            district_info = resolve_district(district)
            if district_info is not None:
                ref_lat, ref_lng = district_info.lat, district_info.lng

        if radius is not None and (ref_lat is None or ref_lng is None):
            raise BadRequestException(
                message="Vui lòng cung cấp tọa độ (lat, lng) hoặc khu vực hợp lệ khi lọc theo bán kính",
                fields={"radius": "Thiếu tọa độ trung tâm (lat, lng) hoặc khu vực (district) để tính bán kính"},
            )

        return ref_lat, ref_lng, radius

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
        """Tính khoảng cách đường chim bay (km) giữa 2 tọa độ theo công thức Haversine (R = 6371 km)."""
        return round(haversine_km(lat1, lon1, lat2, lon2), 2)

    @classmethod
    def combine_bounds(
        cls,
        bbox: Optional[str],
        ref_lat: Optional[float],
        ref_lng: Optional[float],
        radius_km: Optional[float],
    ) -> Tuple[Optional[Tuple[float, float, float, float]], bool]:
        """
        Kết hợp khung nhìn bbox và khung lọc thô quanh bán kính (lat, lng, radius).
        Trả về (bounds, is_empty_intersection).
        """
        bounds = cls.parse_bbox(bbox) if bbox is not None else None

        if radius_km is not None and ref_lat is not None and ref_lng is not None:
            rad_bounds = bounding_box_for_radius(ref_lat, ref_lng, radius_km)
            if bounds is not None:
                min_lng = max(bounds[0], rad_bounds[0])
                min_lat = max(bounds[1], rad_bounds[1])
                max_lng = min(bounds[2], rad_bounds[2])
                max_lat = min(bounds[3], rad_bounds[3])
                if min_lng > max_lng or min_lat > max_lat:
                    return None, True
                bounds = (min_lng, min_lat, max_lng, max_lat)
            else:
                bounds = rad_bounds

        return bounds, False

    async def get_listings(
        self,
        db: AsyncSession,
        bbox: Optional[str] = None,
        q: Optional[str] = None,
        category: Optional[str] = None,
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
        Lấy danh sách tin đăng trên bản đồ / tìm kiếm theo từ khóa và bộ lọc (UC-02, UC-03, FR-03..FR-06, SDD 6.3):
          - Từ khóa q tối đa 100 ký tự (trả 400 nếu vượt quá).
          - Hỗ trợ tham số category (ID hoặc tên) và category_id.
          - Bán kính radius từ 1 đến 20 km (trả 400 nếu ngoài khoảng): lọc thô khung lat/lng rồi Haversine R = 6371 km.
          - Khu vực district khớp chuỗi address (tránh 'Quận 1' khớp nhầm 'Quận 10/11/12') + tâm quận dự phòng.
          - Kết quả trả về kèm distance (km), categoryName, thumbnailUrl; tối đa 50 tin.
        """
        keyword = self.validate_keyword(q)
        resolved_cat_id, resolved_cat_name = self.validate_category(
            category=category, category_id=category_id
        )
        validated_min_score = self.validate_min_score(min_score)
        validated_sort = self.validate_sort(sort)
        cleaned_district = self.validate_district(district)
        ref_lat, ref_lng, radius_km = self.validate_location_and_radius(
            lat=lat,
            lng=lng,
            radius=radius,
            district=cleaned_district,
        )
        safe_limit = min(max(1, limit), self.MAX_LISTINGS_LIMIT)

        bounds, is_empty = self.combine_bounds(bbox, ref_lat, ref_lng, radius_km)
        if is_empty:
            return []

        district_terms = get_district_search_terms(cleaned_district) if cleaned_district else None

        listings = await self.listing_repo.find_filtered(
            db,
            bounds=bounds,
            q=keyword,
            category_id=resolved_cat_id,
            category_name=resolved_cat_name,
            min_score=validated_min_score,
            district_terms=district_terms,
            center_lat=ref_lat,
            center_lng=ref_lng,
            radius_km=radius_km,
            sort=validated_sort,
            limit=safe_limit,
        )

        items_with_meta: List[Tuple[float, ListingMapItem]] = []
        for item in listings:
            if cleaned_district and not address_matches_district(item.address, cleaned_district):
                continue

            total_score_val = float(item.total_score)
            if validated_min_score is not None and total_score_val < validated_min_score:
                continue

            rank_label = ScoreCalculator.get_rank(total_score_val)

            item_dist: Optional[float] = None
            raw_dist = 0.0
            if ref_lat is not None and ref_lng is not None:
                raw_dist = haversine_km(ref_lat, ref_lng, float(item.lat), float(item.lng))
                if radius_km is not None and raw_dist > radius_km + 1e-9:
                    continue
                item_dist = round(raw_dist, 2)

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

            items_with_meta.append(
                (
                    raw_dist,
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
                    ),
                )
            )

        if validated_sort == "distance" and ref_lat is not None and ref_lng is not None:
            items_with_meta.sort(key=lambda pair: pair[0])
        elif validated_sort == "score":
            items_with_meta.sort(key=lambda pair: (-pair[1].total_score, pair[0]))
        elif validated_sort == "newest":
            items_with_meta.sort(
                key=lambda pair: (
                    pair[1].created_at.replace(tzinfo=timezone.utc)
                    if pair[1].created_at and pair[1].created_at.tzinfo is None
                    else (pair[1].created_at or datetime.min.replace(tzinfo=timezone.utc))
                ),
                reverse=True,
            )

        return [dto for _, dto in items_with_meta[:safe_limit]]

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

    async def create_listing(
        self,
        db: AsyncSession,
        *,
        seller: User,
        title: str,
        category_id: Optional[int],
        price: Optional[float],
        description: str,
        address: str,
        lat: Optional[float],
        lng: Optional[float],
        score_appearance: Optional[float],
        score_function: Optional[float],
        score_accessories: Optional[float],
        photos: List[UploadFile],
    ) -> ListingCreateResponse:
        """
        Tạo tin đăng bán đồ cũ mới (STT 31, 36, TE9C746, UC-05, FR-08, FR-09):
          - Nhận multipart: title, category_id, price, description, lat, lng, address, 1-5 ảnh, 3 điểm thành phần.
          - Kiểm tra các trường bắt buộc, giá 0-1.000.000.000, điểm 0-10, ảnh 1-5 tệp.
          - Lỗi 400 kèm fields để client đánh dấu đúng trường.
          - Server tính lại điểm tổng bằng ScoreCalculator và bỏ qua giá trị client (TC-05).
          - Lưu status = 'pending'.
          - Trả 201 kèm id, status, totalScore, rank, message = 'Đã gửi, chờ duyệt'.
        """
        fields: Dict[str, str] = {}

        # 1. Kiểm tra Tiêu đề
        clean_title = (title or "").strip()
        if not clean_title:
            fields["title"] = "Tiêu đề không được để trống (E1)"
        elif len(clean_title) > 100:
            fields["title"] = "Tiêu đề không được vượt quá 100 ký tự"

        # 2. Kiểm tra Danh mục
        if category_id is None:
            fields["categoryId"] = "Vui lòng chọn danh mục (E1)"
        else:
            cat_repo = CategoryRepository()
            cat = await cat_repo.find_by_id(db, category_id)
            if not cat:
                fields["categoryId"] = f"Danh mục #{category_id} không tồn tại"

        # 3. Kiểm tra Giá bán (BR-05, E4)
        if price is None:
            fields["price"] = "Giá không được để trống (E1)"
        else:
            try:
                num_price = float(price)
                if num_price < 0 or num_price > 1_000_000_000:
                    fields["price"] = "Giá bán phải từ 0 đến 1.000.000.000 đ (BR-05, E4)"
            except (ValueError, TypeError):
                fields["price"] = "Giá bán không hợp lệ"

        # 4. Kiểm tra Mô tả
        clean_desc = (description or "").strip()
        if not clean_desc:
            fields["description"] = "Mô tả chi tiết không được để trống (E1)"

        # 5. Kiểm tra Địa chỉ và Tọa độ
        clean_address = (address or "").strip()
        if not clean_address:
            fields["address"] = "Địa chỉ giao dịch không được để trống (E1)"

        effective_lat = float(lat) if lat is not None else 10.7769
        effective_lng = float(lng) if lng is not None else 106.7009

        # 6. Kiểm tra 3 điểm thành phần (0.0 - 10.0, E3)
        for name, val in [
            ("appearance", score_appearance),
            ("function", score_function),
            ("accessories", score_accessories),
        ]:
            if val is None:
                fields[name] = f"Điểm {name} không được để trống (E1)"
            else:
                try:
                    num_val = float(val)
                    if num_val < 0.0 or num_val > 10.0:
                        fields[name] = f"Điểm {name} phải từ 0 đến 10 (E3)"
                except (ValueError, TypeError):
                    fields[name] = f"Điểm {name} không hợp lệ"

        # 7. Kiểm tra ảnh tải lên (1-5 ảnh, BR-04)
        if not photos or len(photos) == 0:
            fields["photos"] = "Vui lòng tải lên ít nhất 1 ảnh sản phẩm (BR-04)"
        elif len(photos) > 5:
            fields["photos"] = "Mỗi tin chỉ được tải tối đa 5 ảnh (BR-04)"

        # Nếu có lỗi trường nào thì ném 400 kèm fields
        if fields:
            raise BadRequestException(message="Dữ liệu đăng tin không hợp lệ", fields=fields)

        # 8. Kiểm tra và lưu từng file ảnh qua adapter
        saved_urls = await process_and_save_upload_files(photos)
        photos_data = [{"url": u, "sort_order": idx} for idx, u in enumerate(saved_urls)]

        # 9. Server tính lại điểm tổng bằng ScoreCalculator và bỏ qua giá trị client (TC-05)
        total_score, rank_label = ScoreCalculator.calculate(
            score_appearance, score_function, score_accessories
        )

        # 10. Lưu tin và ảnh trong cùng 1 transaction, status = 'pending' (chưa hiện bản đồ FR-09)
        listing = await self.listing_repo.create(
            db,
            seller_id=seller.user_id,
            category_id=category_id,
            title=clean_title,
            description=clean_desc,
            price=price,
            address=clean_address,
            lat=effective_lat,
            lng=effective_lng,
            score_appearance=score_appearance,
            score_function=score_function,
            score_accessories=score_accessories,
            total_score=total_score,
            status="pending",
            photos_data=photos_data,
        )

        return ListingCreateResponse(
            id=listing.listing_id,
            status=listing.status,
            total_score=total_score,
            totalScore=total_score,
            rank=rank_label,
            message="Đã gửi, chờ duyệt",
        )

