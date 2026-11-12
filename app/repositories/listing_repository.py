"""
Repository for Listing entity access (SDD 4, SDD 6.1, SDD 6.2, SDD 6.3).
Uses SQLAlchemy 2.0 AsyncSession.
"""

from typing import List, Optional, Tuple
from sqlalchemy import case, func, or_, select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.category import Category
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

    @classmethod
    def _apply_category_filter(
        cls,
        stmt,
        category_id: Optional[int] = None,
        category_name: Optional[str] = None,
    ):
        """Lọc tin theo ID danh mục (tận dụng idx_listings_category) hoặc tên danh mục (FR-06)."""
        if category_id is not None:
            stmt = stmt.where(Listing.category_id == category_id)
        elif category_name:
            esc = cls._escape_like(category_name)
            stmt = stmt.where(
                Listing.category.has(Category.name.ilike(esc, escape="/"))
            )
        return stmt

    @classmethod
    def _apply_district_filter(cls, stmt, district_terms: Optional[List[str]]):
        """
        Lọc theo khu vực dựa trên chuỗi address (khớp tên quận/alias, tránh 'Quận 1' khớp 'Quận 10').
        """
        if not district_terms:
            return stmt

        clauses = []
        for term in district_terms:
            if not term:
                continue
            esc = cls._escape_like(term)
            if term[-1].isdigit():
                clauses.extend(
                    [
                        Listing.address.ilike(f"%{esc}", escape="/"),
                        Listing.address.ilike(f"%{esc},%", escape="/"),
                        Listing.address.ilike(f"%{esc} %", escape="/"),
                        Listing.address.ilike(f"%{esc}.%", escape="/"),
                        Listing.address.ilike(f"%{esc}-%", escape="/"),
                        Listing.address.ilike(f"%{esc}/%", escape="/"),
                        Listing.address.ilike(f"%{esc};%", escape="/"),
                        Listing.address.ilike(f"%{esc})%", escape="/"),
                    ]
                )
            else:
                clauses.append(Listing.address.ilike(f"%{esc}%", escape="/"))

        if clauses:
            stmt = stmt.where(or_(*clauses))
        return stmt

    @staticmethod
    def _haversine_sql(center_lat: float, center_lng: float):
        """Biểu thức SQL tính khoảng cách Haversine (km) với R = 6371 km (SDD 6.3)."""
        d_lat = func.radians(Listing.lat - center_lat)
        d_lng = func.radians(Listing.lng - center_lng)
        sin_dlat = func.sin(d_lat / 2.0)
        sin_dlng = func.sin(d_lng / 2.0)
        a = (
            sin_dlat * sin_dlat
            + func.cos(func.radians(center_lat))
            * func.cos(func.radians(Listing.lat))
            * sin_dlng
            * sin_dlng
        )
        safe_a = case((a > 1.0, 1.0), (a < 0.0, 0.0), else_=a)
        return 6371.0 * 2.0 * func.asin(func.sqrt(safe_a))

    @classmethod
    def _apply_filters(
        cls,
        stmt,
        q: Optional[str] = None,
        category_id: Optional[int] = None,
        category_name: Optional[str] = None,
        min_score: Optional[float] = None,
        district_terms: Optional[List[str]] = None,
    ):
        stmt = cls._apply_keyword_filter(stmt, q)
        stmt = cls._apply_category_filter(stmt, category_id=category_id, category_name=category_name)
        if min_score is not None:
            stmt = stmt.where(Listing.total_score >= min_score)
        stmt = cls._apply_district_filter(stmt, district_terms)
        return stmt

    async def find_filtered(
        self,
        db: AsyncSession,
        bounds: Optional[Tuple[float, float, float, float]] = None,
        q: Optional[str] = None,
        category_id: Optional[int] = None,
        category_name: Optional[str] = None,
        min_score: Optional[float] = None,
        district_terms: Optional[List[str]] = None,
        center_lat: Optional[float] = None,
        center_lng: Optional[float] = None,
        radius_km: Optional[float] = None,
        sort: Optional[str] = "distance",
        limit: int = 50,
    ) -> List[Listing]:
        """
        Truy vấn tin đang bán (status = 'selling') kết hợp lọc bản đồ, từ khóa, danh mục,
        điểm tối thiểu, khu vực và lọc thô + Haversine theo bán kính (SDD 6.3).
        """
        stmt = (
            select(Listing)
            .options(
                selectinload(Listing.photos),
                selectinload(Listing.category),
            )
            .where(Listing.status == "selling")
        )

        if bounds is not None:
            min_lng, min_lat, max_lng, max_lat = bounds
            stmt = stmt.where(
                Listing.lat >= min_lat,
                Listing.lat <= max_lat,
                Listing.lng >= min_lng,
                Listing.lng <= max_lng,
            )

        stmt = self._apply_filters(
            stmt,
            q=q,
            category_id=category_id,
            category_name=category_name,
            min_score=min_score,
            district_terms=district_terms,
        )

        has_center = center_lat is not None and center_lng is not None
        dist_expr = self._haversine_sql(center_lat, center_lng) if has_center else None

        if radius_km is not None and dist_expr is not None:
            stmt = stmt.where(dist_expr <= radius_km + 1e-9)

        if sort == "score":
            if dist_expr is not None:
                stmt = stmt.order_by(
                    Listing.total_score.desc(),
                    dist_expr.asc(),
                    Listing.created_at.desc(),
                )
            else:
                stmt = stmt.order_by(Listing.total_score.desc(), Listing.created_at.desc())
        elif sort == "distance" and dist_expr is not None:
            stmt = stmt.order_by(dist_expr.asc(), Listing.created_at.desc())
        else:
            stmt = stmt.order_by(Listing.created_at.desc())

        stmt = stmt.limit(limit)
        result = await db.execute(stmt)
        return list(result.scalars().all())

    async def find_in_bounds(
        self,
        db: AsyncSession,
        min_lng: float,
        min_lat: float,
        max_lng: float,
        max_lat: float,
        q: Optional[str] = None,
        category_id: Optional[int] = None,
        min_score: Optional[float] = None,
        district: Optional[str] = None,
        limit: int = 50,
    ) -> List[Listing]:
        """
        Lấy các tin đăng trong khung nhìn bản đồ (bbox), có thể kết hợp lọc từ khóa và bộ lọc.
        """
        return await self.find_filtered(
            db,
            bounds=(min_lng, min_lat, max_lng, max_lat),
            q=q,
            category_id=category_id,
            min_score=min_score,
            district_terms=[district] if district else None,
            limit=limit,
        )

    async def find_selling(
        self,
        db: AsyncSession,
        q: Optional[str] = None,
        category_id: Optional[int] = None,
        min_score: Optional[float] = None,
        district: Optional[str] = None,
        limit: int = 50,
    ) -> List[Listing]:
        """Lấy danh sách tin đang bán không theo bbox, có hỗ trợ lọc theo từ khóa và bộ lọc."""
        return await self.find_filtered(
            db,
            q=q,
            category_id=category_id,
            min_score=min_score,
            district_terms=[district] if district else None,
            limit=limit,
        )

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
