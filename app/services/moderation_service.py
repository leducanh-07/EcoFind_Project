from datetime import datetime, timezone
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import (
    BadRequestException,
    ConflictException,
    NotFoundException,
)
from app.models.listing import Listing
from app.repositories.listing_repository import ListingRepository
from app.schemas.admin import (
    AdminListingDetailResponse,
    AdminListingItem,
    AdminSellerInfo,
    ModerationActionResponse,
    ScoreAdjustments,
)
from app.schemas.listing import PhotoItem
from app.services.score_calculator import ScoreCalculator


class ModerationService:
    """Service xử lý nghiệp vụ kiểm duyệt tin đăng của Admin."""

    def __init__(self, listing_repository: Optional[ListingRepository] = None):
        self.listing_repo = listing_repository or ListingRepository()

    @staticmethod
    def _map_to_admin_item(listing: Listing) -> AdminListingItem:
        photos = [
            PhotoItem(id=p.photo_id, url=p.url, sort_order=p.sort_order)
            for p in (listing.photos or [])
        ]
        thumbnail_url = photos[0].url if photos else None

        seller_name = "Người dùng ẩn danh"
        seller_email = None
        seller_phone = None
        if listing.seller:
            seller_name = listing.seller.full_name or seller_name
            seller_email = listing.seller.email
            seller_phone = listing.seller.phone

        total_score_fl = float(listing.total_score)
        rank_str = ScoreCalculator.get_rank(total_score_fl)

        return AdminListingItem(
            id=listing.listing_id,
            title=listing.title,
            price=float(listing.price),
            category_id=listing.category_id,
            category_name=listing.category.name if listing.category else None,
            seller_id=listing.seller_id,
            seller_name=seller_name,
            seller_email=seller_email,
            seller_phone=seller_phone,
            score_appearance=float(listing.score_appearance),
            score_function=float(listing.score_function),
            score_accessories=float(listing.score_accessories),
            total_score=total_score_fl,
            rank=rank_str,
            status=listing.status,
            address=listing.address,
            thumbnail_url=thumbnail_url,
            photos=photos,
            created_at=listing.created_at,
            reject_reason=listing.reject_reason,
            reviewed_by=listing.reviewed_by,
            reviewed_at=listing.reviewed_at,
        )

    async def get_listings_queue(
        self,
        db: AsyncSession,
        status: Optional[str] = "pending",
        sort: str = "asc",
    ) -> List[AdminListingItem]:
        """Lấy danh sách tin chờ duyệt hoặc theo trạng thái phục vụ hàng đợi Admin."""
        listings = await self.listing_repo.find_for_admin(db, status=status, sort=sort)
        return [self._map_to_admin_item(item) for item in listings]

    async def get_listing_detail(
        self,
        db: AsyncSession,
        listing_id: int,
    ) -> AdminListingDetailResponse:
        """Lấy chi tiết tin đăng kèm 3 điểm thành phần, người bán và ảnh để kiểm tra trước khi duyệt."""
        listing = await self.listing_repo.find_by_id_with_relations(db, listing_id)
        if not listing:
            raise NotFoundException(message=f"Không tìm thấy tin đăng với ID {listing_id}")

        photos = [
            PhotoItem(id=p.photo_id, url=p.url, sort_order=p.sort_order)
            for p in (listing.photos or [])
        ]

        seller_info = AdminSellerInfo(
            user_id=listing.seller_id,
            full_name=listing.seller.full_name if listing.seller else "Chưa xác định",
            email=listing.seller.email if listing.seller else "",
            phone=listing.seller.phone if listing.seller else None,
        )

        total_score_fl = float(listing.total_score)
        rank_str = ScoreCalculator.get_rank(total_score_fl)

        return AdminListingDetailResponse(
            id=listing.listing_id,
            title=listing.title,
            description=listing.description,
            price=float(listing.price),
            address=listing.address,
            lat=float(listing.lat),
            lng=float(listing.lng),
            category_id=listing.category_id,
            category_name=listing.category.name if listing.category else None,
            seller=seller_info,
            score_appearance=float(listing.score_appearance),
            score_function=float(listing.score_function),
            score_accessories=float(listing.score_accessories),
            total_score=total_score_fl,
            rank=rank_str,
            status=listing.status,
            photos=photos,
            created_at=listing.created_at,
            reject_reason=listing.reject_reason,
            reviewed_by=listing.reviewed_by,
            reviewed_at=listing.reviewed_at,
        )

    async def approve_listing(
        self,
        db: AsyncSession,
        listing_id: int,
        admin_id: int,
        adjustments: Optional[ScoreAdjustments] = None,
        note: Optional[str] = None,
    ) -> ModerationActionResponse:
        """
        Duyệt tin đăng (chuyển sang 'selling') và cho phép hạ điểm thành phần nếu người bán chấm cao hơn thực tế.
        """
        listing = await self.listing_repo.find_by_id_with_relations(db, listing_id)
        if not listing:
            raise NotFoundException(message=f"Không tìm thấy tin đăng với ID {listing_id}")

        # Tin đã xử lý trả 409
        if listing.status != "pending":
            raise ConflictException(
                message=f"Tin đăng đã được xử lý (trạng thái hiện tại: {listing.status})"
            )

        # Kiểm tra quy tắc hạ điểm: chỉ được hạ điểm (điểm mới <= điểm cũ)
        if adjustments:
            cur_app = float(listing.score_appearance)
            cur_func = float(listing.score_function)
            cur_acc = float(listing.score_accessories)

            new_app = adjustments.score_appearance if adjustments.score_appearance is not None else cur_app
            new_func = adjustments.score_function if adjustments.score_function is not None else cur_func
            new_acc = adjustments.score_accessories if adjustments.score_accessories is not None else cur_acc

            if adjustments.score_appearance is not None and adjustments.score_appearance > cur_app:
                raise BadRequestException(
                    message=f"Chỉ được phép hạ điểm. Điểm ngoại quan mới ({adjustments.score_appearance}) không được cao hơn ban đầu ({cur_app})"
                )
            if adjustments.score_function is not None and adjustments.score_function > cur_func:
                raise BadRequestException(
                    message=f"Chỉ được phép hạ điểm. Điểm chức năng mới ({adjustments.score_function}) không được cao hơn ban đầu ({cur_func})"
                )
            if adjustments.score_accessories is not None and adjustments.score_accessories > cur_acc:
                raise BadRequestException(
                    message=f"Chỉ được phép hạ điểm. Điểm phụ kiện mới ({adjustments.score_accessories}) không được cao hơn ban đầu ({cur_acc})"
                )

            # Tính lại điểm tổng và phân hạng qua ScoreCalculator
            recalculated_total = ScoreCalculator.calculate_total(new_app, new_func, new_acc)
            listing.score_appearance = new_app
            listing.score_function = new_func
            listing.score_accessories = new_acc
            listing.total_score = recalculated_total

        # Cập nhật trạng thái sang selling và ghi nhận người duyệt
        listing.status = "selling"
        listing.reviewed_by = admin_id
        listing.reviewed_at = datetime.now(timezone.utc)
        if note:
            listing.reject_reason = note

        await db.commit()
        await db.refresh(listing)

        total_score_fl = float(listing.total_score)
        rank_str = ScoreCalculator.get_rank(total_score_fl)

        return ModerationActionResponse(
            id=listing.listing_id,
            status="selling",
            total_score=total_score_fl,
            rank=rank_str,
            message="Duyệt tin thành công, tin đã được hiển thị trên bản đồ",
            reviewed_at=listing.reviewed_at,
            reject_reason=listing.reject_reason,
        )

    async def reject_listing(
        self,
        db: AsyncSession,
        listing_id: int,
        admin_id: int,
        reason: str,
    ) -> ModerationActionResponse:
        """
        Từ chối tin đăng vi phạm kèm lý do bắt buộc.
        """
        if not reason or not reason.strip():
            raise BadRequestException(
                message="Lý do từ chối là bắt buộc",
                fields={"reason": "Vui lòng nhập lý do từ chối tin đăng"},
            )

        listing = await self.listing_repo.find_by_id_with_relations(db, listing_id)
        if not listing:
            raise NotFoundException(message=f"Không tìm thấy tin đăng với ID {listing_id}")

        # Tin đã xử lý trả 409
        if listing.status != "pending":
            raise ConflictException(
                message=f"Tin đăng đã được xử lý (trạng thái hiện tại: {listing.status})"
            )

        listing.status = "rejected"
        listing.reject_reason = reason.strip()
        listing.reviewed_by = admin_id
        listing.reviewed_at = datetime.now(timezone.utc)

        await db.commit()
        await db.refresh(listing)

        total_score_fl = float(listing.total_score)
        rank_str = ScoreCalculator.get_rank(total_score_fl)

        return ModerationActionResponse(
            id=listing.listing_id,
            status="rejected",
            total_score=total_score_fl,
            rank=rank_str,
            message="Đã từ chối tin đăng",
            reviewed_at=listing.reviewed_at,
            reject_reason=listing.reject_reason,
        )
