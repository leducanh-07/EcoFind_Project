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
from app.repositories.user_repository import UserRepository
from app.schemas.admin import (
    AdminCategoryBreakdown,
    AdminDashboardStatsResponse,
    AdminListingDetailResponse,
    AdminListingItem,
    AdminSellerInfo,
    AdminStatusCounts,
    ModerationActionResponse,
    ScoreAdjustments,
)
from app.schemas.listing import PhotoItem
from app.services.score_calculator import ScoreCalculator


class ModerationService:
    """Service xử lý nghiệp vụ kiểm duyệt tin đăng của Admin."""

    def __init__(
        self,
        listing_repository: Optional[ListingRepository] = None,
        user_repository: Optional[UserRepository] = None,
    ):
        self.listing_repo = listing_repository or ListingRepository()
        self.user_repo = user_repository or UserRepository()

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
            hidden_by_admin=bool(listing.hidden_by_admin),
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
            hidden_by_admin=bool(listing.hidden_by_admin),
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

        # Kiểm tra quy tắc hạ điểm: chỉ được hạ điểm (điểm mới <= điểm cũ, BR-01, UC-09 A2)
        if adjustments:
            if isinstance(adjustments, dict):
                adj_app = adjustments.get("score_appearance") or adjustments.get("scoreAppearance") or adjustments.get("appearance")
                adj_func = adjustments.get("score_function") or adjustments.get("scoreFunction") or adjustments.get("function")
                adj_acc = adjustments.get("score_accessories") or adjustments.get("scoreAccessories") or adjustments.get("accessories")
            else:
                adj_app = adjustments.score_appearance
                adj_func = adjustments.score_function
                adj_acc = adjustments.score_accessories

            cur_app = float(listing.score_appearance)
            cur_func = float(listing.score_function)
            cur_acc = float(listing.score_accessories)

            # Kiểm tra khoảng điểm hợp lệ 0-10 (E3)
            for score_label, val in [("ngoại quan", adj_app), ("chức năng", adj_func), ("phụ kiện", adj_acc)]:
                if val is not None and (val < 0.0 or val > 10.0):
                    raise BadRequestException(
                        message=f"Điểm {score_label} phải nằm trong khoảng từ 0.0 đến 10.0. Nhận được: {val}"
                    )

            if adj_app is not None and adj_app > cur_app:
                raise BadRequestException(
                    message=f"Chỉ được phép hạ điểm. Điểm ngoại quan mới ({adj_app}) không được cao hơn ban đầu ({cur_app})"
                )
            if adj_func is not None and adj_func > cur_func:
                raise BadRequestException(
                    message=f"Chỉ được phép hạ điểm. Điểm chức năng mới ({adj_func}) không được cao hơn ban đầu ({cur_func})"
                )
            if adj_acc is not None and adj_acc > cur_acc:
                raise BadRequestException(
                    message=f"Chỉ được phép hạ điểm. Điểm phụ kiện mới ({adj_acc}) không được cao hơn ban đầu ({cur_acc})"
                )

            new_app = adj_app if adj_app is not None else cur_app
            new_func = adj_func if adj_func is not None else cur_func
            new_acc = adj_acc if adj_acc is not None else cur_acc

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
        if note and note.strip():
            listing.reject_reason = note.strip()

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
            reviewed_by=listing.reviewed_by,
            reviewed_at=listing.reviewed_at,
            reject_reason=listing.reject_reason,
            review_note=listing.reject_reason,
            note=listing.reject_reason,
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
            reviewed_by=listing.reviewed_by,
            reviewed_at=listing.reviewed_at,
            reject_reason=listing.reject_reason,
            review_note=listing.reject_reason,
            note=listing.reject_reason,
        )

    async def hide_listing(
        self,
        db: AsyncSession,
        listing_id: int,
        admin_id: int,
        reason: Optional[str] = None,
    ) -> ModerationActionResponse:
        """Admin ẩn trực tiếp tin đăng vi phạm hoặc không phù hợp khỏi hệ thống."""
        listing = await self.listing_repo.find_by_id_with_relations(db, listing_id)
        if not listing:
            raise NotFoundException(message=f"Không tìm thấy tin đăng với ID {listing_id}")

        if listing.status == "sold":
            raise BadRequestException(message="Không thể ẩn tin đăng đã đánh dấu đã bán")

        if listing.status == "hidden" and listing.hidden_by_admin:
            raise ConflictException(message="Tin đăng này đã được Quản trị viên ẩn trước đó")

        listing.status = "hidden"
        listing.hidden_by_admin = True
        listing.reviewed_by = admin_id
        listing.reviewed_at = datetime.now(timezone.utc)
        if reason and reason.strip():
            listing.reject_reason = reason.strip()

        await db.commit()
        await db.refresh(listing)

        total_score_fl = float(listing.total_score)
        return ModerationActionResponse(
            id=listing.listing_id,
            status="hidden",
            total_score=total_score_fl,
            rank=ScoreCalculator.get_rank(total_score_fl),
            message="Đã ẩn tin đăng vi phạm khỏi bản đồ công khai",
            reviewed_by=listing.reviewed_by,
            reviewed_at=listing.reviewed_at,
            reject_reason=listing.reject_reason,
            review_note=listing.reject_reason,
            note=listing.reject_reason,
        )

    async def restore_listing(
        self,
        db: AsyncSession,
        listing_id: int,
        admin_id: int,
    ) -> ModerationActionResponse:
        """Admin khôi phục tin đăng đang ở trạng thái ẩn về lại Đang bán."""
        listing = await self.listing_repo.find_by_id_with_relations(db, listing_id)
        if not listing:
            raise NotFoundException(message=f"Không tìm thấy tin đăng với ID {listing_id}")

        if listing.status != "hidden":
            raise ConflictException(
                message=f"Chỉ có thể khôi phục tin đăng đang ở trạng thái ẩn (hiện tại: {listing.status})"
            )

        listing.status = "selling"
        listing.hidden_by_admin = False
        listing.reviewed_by = admin_id
        listing.reviewed_at = datetime.now(timezone.utc)

        await db.commit()
        await db.refresh(listing)

        total_score_fl = float(listing.total_score)
        return ModerationActionResponse(
            id=listing.listing_id,
            status="selling",
            total_score=total_score_fl,
            rank=ScoreCalculator.get_rank(total_score_fl),
            message="Đã khôi phục tin đăng hiển thị lại trên bản đồ",
            reviewed_by=listing.reviewed_by,
            reviewed_at=listing.reviewed_at,
            reject_reason=listing.reject_reason,
            review_note=listing.reject_reason,
            note=listing.reject_reason,
        )

    async def get_dashboard_stats(self, db: AsyncSession) -> AdminDashboardStatsResponse:
        """Tổng hợp thống kê KPI & phân bổ danh mục phục vụ Admin Dashboard."""
        now_dt = datetime.now(timezone.utc)
        listing_stats = await self.listing_repo.get_admin_listing_stats(db)
        other_counts = await self.user_repo.get_admin_reports_and_user_counts(db, now_dt)

        status_counts = listing_stats.get("status_counts", {})
        counts = AdminStatusCounts(
            pending=status_counts.get("pending", 0),
            selling=status_counts.get("selling", 0),
            hidden=status_counts.get("hidden", 0),
            rejected=status_counts.get("rejected", 0),
            sold=status_counts.get("sold", 0),
            reports_new=other_counts.get("reports_new", 0),
            reports_resolved=other_counts.get("reports_resolved", 0),
            users_total=other_counts.get("users_total", 0),
            users_locked=other_counts.get("users_locked", 0),
        )
        categories = [
            AdminCategoryBreakdown(**cat) for cat in listing_stats.get("categories", [])
        ]

        return AdminDashboardStatsResponse(
            counts=counts,
            avg_selling_score=listing_stats.get("avg_selling_score"),
            categories=categories,
        )
