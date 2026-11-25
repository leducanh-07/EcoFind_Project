"""
User Profile Service (Personal Profile, Password Change, Admin Stats & Public Seller Profile).
All persistence adheres strictly to fixed SDD 6.1 schema.
"""

from datetime import datetime, timedelta, timezone
import re
from typing import Dict, List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.exceptions import BadRequestException, ForbiddenException, NotFoundException
from app.core.security import get_password_hash, verify_password
from app.models.listing import Listing
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.admin import AdminUserItem, AdminUserLockResponse
from app.schemas.listing import ListingMapItem
from app.schemas.user import (
    AdminSystemStats,
    CategorySummary,
    ChangePasswordRequest,
    MyProfileResponse,
    MyProfileStats,
    ProfileUpdateRequest,
    PublicSellerProfileResponse,
    PublicSellerStats,
)
from app.services.score_calculator import ScoreCalculator

PHONE_PATTERN = re.compile(r"^[0-9+()\-\s]{8,20}$")


class UserService:
    """Service xử lý hồ sơ cá nhân, đổi mật khẩu và trang công khai của người bán."""

    def __init__(self, user_repo: Optional[UserRepository] = None):
        self.user_repo = user_repo or UserRepository()

    @staticmethod
    def _derive_activity_role(
        *,
        role: str,
        top_categories: List[CategorySummary],
        total_listings: int,
        favorites_count: int,
    ) -> str:
        """Tự động suy ra vai trò hoạt động từ dữ liệu bảng users, listings, categories, favorites."""
        if role == "admin":
            return "Quản trị viên kiểm duyệt & vận hành hệ thống"
        if top_categories:
            names = " & ".join(cat.name for cat in top_categories[:2])
            return f"Người bán · Chuyên {names}"
        if total_listings > 0:
            return "Người bán đồ cũ trên EcoFind"
        if favorites_count > 0:
            return "Thành viên mua sắm đồ cũ EcoFind"
        return "Thành viên EcoFind"

    @staticmethod
    def _map_public_listings(listings: List[Listing]) -> List[ListingMapItem]:
        mapped: List[ListingMapItem] = []
        for listing in listings:
            photos = sorted(listing.photos or [], key=lambda p: p.sort_order)
            thumbnail_url = photos[0].url if photos else None
            total_score = float(listing.total_score)

            mapped.append(
                ListingMapItem(
                    id=listing.listing_id,
                    title=listing.title,
                    price=float(listing.price),
                    lat=float(listing.lat),
                    lng=float(listing.lng),
                    total_score=total_score,
                    rank=ScoreCalculator.get_rank(total_score),
                    status=listing.status,
                    category_id=listing.category_id,
                    category_name=listing.category.name if listing.category else None,
                    thumbnail_url=thumbnail_url,
                    address=listing.address,
                    created_at=listing.created_at,
                )
            )
        return mapped

    async def get_my_profile(self, db: AsyncSession, *, user: User) -> MyProfileResponse:
        """Lấy thông tin hồ sơ cá nhân kèm thống kê hoạt động chuẩn SDD 6.1."""
        counts = await self.user_repo.get_listing_status_counts(db, user.user_id)
        favorites_count = await self.user_repo.get_favorites_count(db, user.user_id)
        reports_count = await self.user_repo.get_reports_count(db, user.user_id)
        raw_categories = await self.user_repo.get_seller_top_categories(db, user.user_id)
        top_categories = [CategorySummary(**cat) for cat in raw_categories]

        active_listings = await self.user_repo.find_public_seller_listings(db, user.user_id)
        mapped_listings = self._map_public_listings(active_listings)
        avg_score = (
            round(sum(item.total_score for item in mapped_listings) / len(mapped_listings), 1)
            if mapped_listings
            else None
        )

        total_listings = sum(counts.values())
        stats = MyProfileStats(
            selling_count=counts.get("selling", 0),
            pending_count=counts.get("pending", 0),
            sold_count=counts.get("sold", 0),
            total_listings=total_listings,
            favorites_count=favorites_count,
            reports_count=reports_count,
            avg_score=avg_score,
        )

        admin_stats = None
        if user.role == "admin":
            raw_admin_stats = await self.user_repo.get_admin_system_stats(db)
            admin_stats = AdminSystemStats(**raw_admin_stats)

        now = datetime.now(timezone.utc)
        locked_until = user.locked_until
        if locked_until and locked_until.tzinfo is None:
            locked_until = locked_until.replace(tzinfo=timezone.utc)
        is_locked = bool(locked_until and locked_until > now)

        activity_role = self._derive_activity_role(
            role=user.role,
            top_categories=top_categories,
            total_listings=total_listings,
            favorites_count=favorites_count,
        )

        return MyProfileResponse(
            user_id=user.user_id,
            full_name=user.full_name,
            email=user.email,
            phone=user.phone,
            role=user.role,
            failed_attempts=int(user.failed_attempts or 0),
            is_locked=is_locked,
            activity_role=activity_role,
            top_categories=top_categories,
            stats=stats,
            admin_stats=admin_stats,
            featured_listings=mapped_listings[:4] if user.role != "admin" else [],
        )

    async def update_my_profile(
        self,
        db: AsyncSession,
        *,
        user: User,
        payload: ProfileUpdateRequest,
    ) -> MyProfileResponse:
        """Cập nhật họ tên và số điện thoại của tài khoản đang đăng nhập (SDD 6.1)."""
        clean_name = payload.full_name.strip()
        if len(clean_name) < 2:
            raise BadRequestException(
                message="Họ và tên phải có ít nhất 2 ký tự",
                fields={"fullName": "Họ và tên phải có ít nhất 2 ký tự"},
            )

        clean_phone: Optional[str] = None
        if payload.phone is not None and payload.phone.strip():
            candidate_phone = payload.phone.strip()
            if not PHONE_PATTERN.match(candidate_phone):
                raise BadRequestException(
                    message="Số điện thoại không hợp lệ (tối thiểu 8 chữ số)",
                    fields={"phone": "Số điện thoại không hợp lệ (tối thiểu 8 chữ số)"},
                )
            clean_phone = candidate_phone

        user.full_name = clean_name
        user.phone = clean_phone
        updated_user = await self.user_repo.update(db, user)
        return await self.get_my_profile(db, user=updated_user)

    async def change_password(
        self,
        db: AsyncSession,
        *,
        user: User,
        payload: ChangePasswordRequest,
    ) -> Dict[str, str]:
        """Đổi mật khẩu tài khoản (áp dụng cho cả User và Admin)."""
        if not verify_password(payload.current_password, user.password_hash):
            raise BadRequestException(
                message="Mật khẩu hiện tại không đúng",
                fields={"currentPassword": "Mật khẩu hiện tại không đúng"},
            )

        if payload.new_password != payload.confirm_password:
            raise BadRequestException(
                message="Mật khẩu xác nhận không khớp với mật khẩu mới",
                fields={"confirmPassword": "Mật khẩu xác nhận không khớp"},
            )

        if payload.new_password == payload.current_password:
            raise BadRequestException(
                message="Mật khẩu mới phải khác mật khẩu hiện tại",
                fields={"newPassword": "Mật khẩu mới phải khác mật khẩu hiện tại"},
            )

        user.password_hash = get_password_hash(payload.new_password)
        user.failed_attempts = 0
        user.locked_until = None
        await self.user_repo.update(db, user)
        return {"message": "Đổi mật khẩu thành công"}

    async def get_public_seller_profile(
        self,
        db: AsyncSession,
        *,
        user_id: int,
    ) -> PublicSellerProfileResponse:
        """Lấy trang hồ sơ công khai của người bán cùng danh mục nổi bật và tin đang bán."""
        user = await self.user_repo.find_by_id(db, user_id)
        if not user:
            raise NotFoundException(message="Không tìm thấy người dùng", code=404)

        counts = await self.user_repo.get_listing_status_counts(db, user.user_id)
        favorites_count = await self.user_repo.get_favorites_count(db, user.user_id)
        raw_categories = await self.user_repo.get_seller_top_categories(db, user.user_id)
        top_categories = [CategorySummary(**cat) for cat in raw_categories]

        active_listings = await self.user_repo.find_public_seller_listings(db, user.user_id)
        mapped_listings = self._map_public_listings(active_listings)
        avg_score = (
            round(sum(item.total_score for item in mapped_listings) / len(mapped_listings), 1)
            if mapped_listings
            else None
        )

        activity_role = self._derive_activity_role(
            role=user.role,
            top_categories=top_categories,
            total_listings=sum(counts.values()),
            favorites_count=favorites_count,
        )

        return PublicSellerProfileResponse(
            user_id=user.user_id,
            full_name=user.full_name,
            role=user.role,
            activity_role=activity_role,
            top_categories=top_categories,
            stats=PublicSellerStats(
                selling_count=len(mapped_listings),
                sold_count=counts.get("sold", 0),
                avg_score=avg_score,
            ),
            listings=mapped_listings,
        )

    async def get_admin_users_list(self, db: AsyncSession) -> List[AdminUserItem]:
        """Lấy danh sách tài khoản thành viên kèm trạng thái khóa và thống kê cho Admin."""
        records = await self.user_repo.find_all_for_admin_management(db)
        now = datetime.now(timezone.utc)
        items: List[AdminUserItem] = []
        for entry in records:
            u: User = entry["user"]
            locked_until = u.locked_until
            if locked_until and locked_until.tzinfo is None:
                locked_until = locked_until.replace(tzinfo=timezone.utc)
            is_locked = bool(locked_until and locked_until > now)
            items.append(
                AdminUserItem(
                    user_id=u.user_id,
                    full_name=u.full_name,
                    email=u.email,
                    phone=u.phone,
                    role=u.role,
                    failed_attempts=int(u.failed_attempts or 0),
                    locked_until=locked_until if is_locked else None,
                    is_locked=is_locked,
                    listings_count=int(entry["total"]),
                    selling_count=int(entry["selling"]),
                    hidden_by_admin_count=int(entry["hidden_by_admin"]),
                    reports_received_count=int(entry["reports"]),
                )
            )
        return items

    async def lock_user_by_admin(
        self,
        db: AsyncSession,
        *,
        target_user_id: int,
        admin: User,
        duration_hours: int,
    ) -> AdminUserLockResponse:
        """Khóa tài khoản người dùng bằng cột locked_until (SDD 6.1), chặn khóa Admin."""
        target = await self.user_repo.find_by_id(db, target_user_id)
        if not target:
            raise NotFoundException(message="Không tìm thấy người dùng", code=404)

        if target.user_id == admin.user_id or target.role == "admin":
            raise ForbiddenException(
                message="Không thể khóa tài khoản Quản trị viên",
                code=403,
            )

        locked_until = datetime.now(timezone.utc) + timedelta(hours=duration_hours)
        target.locked_until = locked_until
        await self.user_repo.update(db, target)

        if duration_hours >= 8760:
            duration_label = "dài hạn"
        elif duration_hours >= 24:
            duration_label = f"{duration_hours // 24} ngày"
        else:
            duration_label = f"{duration_hours} giờ"

        return AdminUserLockResponse(
            user_id=target.user_id,
            is_locked=True,
            locked_until=locked_until,
            message=f"Đã khóa tài khoản {target.full_name} ({duration_label})",
        )

    async def unlock_user_by_admin(
        self,
        db: AsyncSession,
        *,
        target_user_id: int,
    ) -> AdminUserLockResponse:
        """Mở khóa tài khoản bị khóa (do Admin khóa hoặc do nhập sai mật khẩu 5 lần)."""
        target = await self.user_repo.find_by_id(db, target_user_id)
        if not target:
            raise NotFoundException(message="Không tìm thấy người dùng", code=404)

        target.locked_until = None
        target.failed_attempts = 0
        await self.user_repo.update(db, target)

        return AdminUserLockResponse(
            user_id=target.user_id,
            is_locked=False,
            locked_until=None,
            message=f"Đã mở khóa tài khoản {target.full_name}",
        )


user_service = UserService()
