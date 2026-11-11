"""
Repository for Listing entity access (SDD 4, SDD 6.1, SDD 6.2).
Uses SQLAlchemy 2.0 AsyncSession.
"""

from typing import List, Optional
from sqlalchemy import or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.listing import Listing


class ListingRepository:
    """Repository chuyên trách truy vấn bảng listings."""

    @staticmethod
    def _escape_like(value: str) -> str:
        """Escape ký tự wildcard (%, _, /) cho SQL LIKE/ILIKE để tìm kiếm chính xác chuỗi."""
        return value.replace("/", "//").replace("%", "/%").replace("_", "/_")

    @classmethod
    def _apply_keyword_filter(cls, stmt, q: Optional[str]):
        """Áp dụng tìm kiếm ILIKE (không phân biệt hoa thường) trên title và description (FR-05)."""
        if q:
            pattern = f"%{cls._escape_like(q)}%"
            stmt = stmt.where(
                or_(
                    Listing.title.ilike(pattern, escape="/"),
                    Listing.description.ilike(pattern, escape="/"),
                )
            )
        return stmt

    async def find_in_bounds(
        self,
        db: AsyncSession,
        min_lng: float,
        min_lat: float,
        max_lng: float,
        max_lat: float,
        q: Optional[str] = None,
        limit: int = 50,
    ) -> List[Listing]:
        """
        Lấy các tin đăng trong khung nhìn bản đồ (bbox), có thể kết hợp lọc từ khóa q.
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
        )
        stmt = self._apply_keyword_filter(stmt, q)
        stmt = stmt.order_by(Listing.created_at.desc()).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def find_selling(
        self,
        db: AsyncSession,
        q: Optional[str] = None,
        limit: int = 50,
    ) -> List[Listing]:
        """Lấy danh sách tin đang bán không theo bbox, có hỗ trợ lọc theo từ khóa q (UC-03, FR-05)."""
        stmt = select(Listing).where(Listing.status == "selling")
        stmt = self._apply_keyword_filter(stmt, q)
        stmt = stmt.order_by(Listing.created_at.desc()).limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def find_by_id(self, db: AsyncSession, listing_id: int) -> Optional[Listing]:
        """Tìm tin đăng theo listing_id."""
        stmt = select(Listing).where(Listing.listing_id == listing_id)
        result = await db.execute(stmt)
        return result.scalar_one_or_none()

    async def find_by_id_with_relations(self, db: AsyncSession, listing_id: int) -> Optional[Listing]:
        """Tìm tin đăng theo listing_id kèm ảnh, danh mục và người bán (UC-04, FR-07)."""
        stmt = (
            select(Listing)
            .options(
                selectinload(Listing.photos),
                selectinload(Listing.category),
                selectinload(Listing.seller),
            )
            .where(Listing.listing_id == listing_id)
        )
        result = await db.execute(stmt)
        return result.scalar_one_or_none()
