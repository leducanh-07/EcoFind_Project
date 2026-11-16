"""
Repository for Favorite entity (SDD 6.1, 6.2, UC-07, FR-11).
"""

from typing import List, Optional, Tuple
from sqlalchemy import select, delete
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.favorite import Favorite
from app.models.listing import Listing


class FavoriteRepository:
    """Xử lý truy vấn CSDL cho bảng favorites."""

    async def is_favorite(self, db: AsyncSession, user_id: int, listing_id: int) -> bool:
        """Kiểm tra tin đã được người dùng lưu yêu thích hay chưa."""
        stmt = select(Favorite).where(
            Favorite.user_id == user_id,
            Favorite.listing_id == listing_id,
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none() is not None

    async def add_favorite(self, db: AsyncSession, user_id: int, listing_id: int) -> bool:
        """Thêm tin vào yêu thích (idempotent: nếu đã có thì không tạo trùng)."""
        already = await self.is_favorite(db, user_id, listing_id)
        if already:
            return False

        fav = Favorite(user_id=user_id, listing_id=listing_id)
        db.add(fav)
        await db.commit()
        return True

    async def remove_favorite(self, db: AsyncSession, user_id: int, listing_id: int) -> bool:
        """Xóa tin khỏi yêu thích (idempotent)."""
        stmt = delete(Favorite).where(
            Favorite.user_id == user_id,
            Favorite.listing_id == listing_id,
        )
        res = await db.execute(stmt)
        await db.commit()
        return res.rowcount > 0

    async def find_by_user(self, db: AsyncSession, user_id: int) -> List[Tuple[Favorite, Listing]]:
        """
        Lấy danh sách tin yêu thích của người dùng kèm thông tin Listing.
        Tận dụng quan hệ và sắp xếp theo thời gian lưu mới nhất.
        """
        stmt = (
            select(Favorite, Listing)
            .join(Listing, Favorite.listing_id == Listing.listing_id)
            .options(
                selectinload(Listing.photos),
                selectinload(Listing.category),
            )
            .where(Favorite.user_id == user_id)
            .order_by(Favorite.created_at.desc())
        )
        result = await db.execute(stmt)
        return result.all()
