"""
Repository for User entity access (SDD 4, SDD 6.1).
Uses SQLAlchemy 2.0 AsyncSession.
"""

from typing import Dict, List, Optional
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.category import Category
from app.models.favorite import Favorite
from app.models.listing import Listing
from app.models.report import Report
from app.models.user import User


class UserRepository:
    """Repository chuyên trách truy vấn và cập nhật bảng users."""

    async def find_by_email(self, db: AsyncSession, email: str) -> Optional[User]:
        """Tìm người dùng qua email (không phân biệt hoa thường)."""
        stmt = select(User).where(User.email == email.strip().lower())
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_by_id(self, db: AsyncSession, user_id: int) -> Optional[User]:
        """Tìm người dùng theo user_id."""
        stmt = select(User).where(User.user_id == user_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def save(self, db: AsyncSession, user: User) -> User:
        """Thêm mới người dùng vào CSDL."""
        db.add(user)
        await db.commit()
        await db.refresh(user)
        return user

    async def update(self, db: AsyncSession, user: User) -> User:
        """Cập nhật thông tin người dùng."""
        await db.commit()
        await db.refresh(user)
        return user

    async def get_listing_status_counts(self, db: AsyncSession, user_id: int) -> Dict[str, int]:
        """Thống kê số lượng tin đăng theo từng trạng thái của người dùng."""
        stmt = (
            select(Listing.status, func.count(Listing.listing_id))
            .where(Listing.seller_id == user_id)
            .group_by(Listing.status)
        )
        result = await db.execute(stmt)
        return {status_name: int(count) for status_name, count in result.all()}

    async def get_favorites_count(self, db: AsyncSession, user_id: int) -> int:
        """Đếm số lượng tin đã lưu yêu thích của người dùng."""
        stmt = select(func.count(Favorite.listing_id)).where(Favorite.user_id == user_id)
        result = await db.execute(stmt)
        count = result.scalar()
        return int(count or 0)

    async def find_public_seller_listings(self, db: AsyncSession, seller_id: int) -> List[Listing]:
        """Lấy các tin đang bán công khai (không bị ẩn) của một người bán."""
        stmt = (
            select(Listing)
            .options(selectinload(Listing.photos), selectinload(Listing.category))
            .where(
                Listing.seller_id == seller_id,
                Listing.status == "selling",
                Listing.hidden_by_admin.is_(False),
            )
            .order_by(Listing.created_at.desc())
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def get_seller_top_categories(self, db: AsyncSession, user_id: int) -> List[Dict[str, object]]:
        """Tổng hợp các danh mục sản phẩm người dùng đăng bán nhiều nhất."""
        stmt = (
            select(Category.name, func.count(Listing.listing_id))
            .join(Listing, Listing.category_id == Category.category_id)
            .where(
                Listing.seller_id == user_id,
                Listing.hidden_by_admin.is_(False),
            )
            .group_by(Category.name)
            .order_by(func.count(Listing.listing_id).desc(), Category.name.asc())
            .limit(3)
        )
        result = await db.execute(stmt)
        return [{"name": name, "count": int(count)} for name, count in result.all()]

    async def get_reports_count(self, db: AsyncSession, user_id: int) -> int:
        """Đếm số báo cáo vi phạm người dùng đã gửi."""
        stmt = select(func.count(Report.report_id)).where(Report.reporter_id == user_id)
        result = await db.execute(stmt)
        return int(result.scalar() or 0)

    async def get_admin_system_stats(self, db: AsyncSession) -> Dict[str, int]:
        """Thống kê số liệu kiểm duyệt hệ thống dành cho Quản trị viên."""
        pending_q = select(func.count(Listing.listing_id)).where(Listing.status == "pending")
        selling_q = select(func.count(Listing.listing_id)).where(
            Listing.status == "selling",
            Listing.hidden_by_admin.is_(False),
        )
        reports_q = select(func.count(Report.report_id)).where(Report.status == "new")
        members_q = select(func.count(User.user_id)).where(User.role == "user")

        pending_cnt = int((await db.execute(pending_q)).scalar() or 0)
        selling_cnt = int((await db.execute(selling_q)).scalar() or 0)
        reports_cnt = int((await db.execute(reports_q)).scalar() or 0)
        members_cnt = int((await db.execute(members_q)).scalar() or 0)

        return {
            "pending_listings_count": pending_cnt,
            "active_selling_count": selling_cnt,
            "open_reports_count": reports_cnt,
            "total_members_count": members_cnt,
        }

    async def get_admin_reports_and_user_counts(self, db: AsyncSession, now_dt) -> Dict[str, int]:
        """Đếm báo cáo theo trạng thái và số thành viên đang hoạt động/đang khóa cho Admin."""
        rep_stmt = select(Report.status, func.count(Report.report_id)).group_by(Report.status)
        rep_rows = (await db.execute(rep_stmt)).all()
        rep_map = {str(st): int(cnt) for st, cnt in rep_rows}

        users_total = int(
            (await db.execute(select(func.count(User.user_id)).where(User.role == "user"))).scalar() or 0
        )
        users_locked = int(
            (
                await db.execute(
                    select(func.count(User.user_id)).where(
                        User.role == "user",
                        User.locked_until.is_not(None),
                        User.locked_until > now_dt,
                    )
                )
            ).scalar()
            or 0
        )

        return {
            "reports_new": rep_map.get("new", 0),
            "reports_resolved": rep_map.get("resolved", 0),
            "users_total": users_total,
            "users_locked": users_locked,
        }

    async def find_all_for_admin_management(self, db: AsyncSession) -> List[Dict[str, object]]:
        """Lấy danh sách thành viên kèm thống kê tin đăng & báo cáo liên quan cho Admin."""
        users_stmt = select(User).order_by(User.role.desc(), User.user_id.asc())
        users = list((await db.execute(users_stmt)).scalars().all())

        listing_stmt = select(
            Listing.seller_id,
            Listing.status,
            Listing.hidden_by_admin,
            func.count(Listing.listing_id),
        ).group_by(Listing.seller_id, Listing.status, Listing.hidden_by_admin)
        listing_rows = (await db.execute(listing_stmt)).all()

        stats_by_user: Dict[int, Dict[str, int]] = {}
        for seller_id, status_name, hidden_by_admin, cnt in listing_rows:
            entry = stats_by_user.setdefault(
                int(seller_id),
                {"total": 0, "selling": 0, "hidden_by_admin": 0, "reports": 0},
            )
            c = int(cnt)
            entry["total"] += c
            if status_name == "selling" and not hidden_by_admin:
                entry["selling"] += c
            if hidden_by_admin:
                entry["hidden_by_admin"] += c

        rep_stmt = (
            select(Listing.seller_id, func.count(Report.report_id))
            .join(Report, Report.listing_id == Listing.listing_id)
            .group_by(Listing.seller_id)
        )
        rep_rows = (await db.execute(rep_stmt)).all()
        for seller_id, rep_cnt in rep_rows:
            entry = stats_by_user.setdefault(
                int(seller_id),
                {"total": 0, "selling": 0, "hidden_by_admin": 0, "reports": 0},
            )
            entry["reports"] += int(rep_cnt)

        results: List[Dict[str, object]] = []
        for u in users:
            s = stats_by_user.get(u.user_id, {"total": 0, "selling": 0, "hidden_by_admin": 0, "reports": 0})
            results.append({"user": u, **s})
        return results
