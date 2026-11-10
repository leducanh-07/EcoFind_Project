"""
Repository for Listing entity access (SDD 4, SDD 6.1, SDD 6.2).
Uses SQLAlchemy 2.0 AsyncSession.
"""

from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.listing import Listing


class ListingRepository:
    """Repository chuyên trách truy vấn bảng listings."""

    async def find_in_bounds(
        self,
        db: AsyncSession,
        min_lng: float,
        min_lat: float,
        max_lng: float,
        max_lat: float,
        limit: int = 50,
    ) -> List[Listing]:
        """
        Lấy các tin đăng trong khung nhìn bản đồ (bbox).
        Ràng buộc:
          - Chỉ tin có status = 'selling' (BR-03, TC-07).
          - Giới hạn tối đa limit tin (mặc định 50).
          - Tận dụng chỉ mục idx_listings_map (SDD 6.2).
        """
        stmt = (
            select(Listing)
            .where(
                Listing.status == "selling",
                Listing.lat >= min_lat,
                Listing.lat <= max_lat,
                Listing.lng >= min_lng,
                Listing.lng <= max_lng,
            )
            .order_by(Listing.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def find_selling(
        self,
        db: AsyncSession,
        limit: int = 50,
    ) -> List[Listing]:
        """Lấy danh sách tin đang bán không theo bbox (tối đa limit tin)."""
        stmt = (
            select(Listing)
            .where(Listing.status == "selling")
            .order_by(Listing.created_at.desc())
            .limit(limit)
        )
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def find_by_id(self, db: AsyncSession, listing_id: int) -> Optional[Listing]:
        """Tìm tin đăng theo listing_id."""
        stmt = select(Listing).where(Listing.listing_id == listing_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

