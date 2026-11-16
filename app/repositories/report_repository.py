"""
Repository for Report entity (SDD 6.1, 6.2, UC-08, UC-09, FR-12, FR-15).
"""

from typing import List, Optional
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession
from app.models.report import Report
from app.models.listing import Listing


class ReportRepository:
    """Xử lý truy vấn CSDL cho bảng reports."""

    async def find_by_reporter_and_listing(
        self,
        db: AsyncSession,
        reporter_id: int,
        listing_id: int,
    ) -> Optional[Report]:
        """Kiểm tra xem người dùng đã báo cáo tin này chưa (ngăn trùng lặp)."""
        stmt = select(Report).where(
            Report.reporter_id == reporter_id,
            Report.listing_id == listing_id,
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def create_report(
        self,
        db: AsyncSession,
        *,
        listing_id: int,
        reporter_id: int,
        reason: str,
        note: Optional[str] = None,
    ) -> Report:
        """Tạo báo cáo vi phạm mới với trạng thái 'new'."""
        report = Report(
            listing_id=listing_id,
            reporter_id=reporter_id,
            reason=reason,
            note=note,
            status="new",
        )
        db.add(report)
        await db.commit()
        await db.refresh(report)
        return report

    async def find_by_id(self, db: AsyncSession, report_id: int) -> Optional[Report]:
        """Tìm báo cáo theo ID."""
        stmt = select(Report).where(Report.report_id == report_id)
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def find_by_id_with_relations(self, db: AsyncSession, report_id: int) -> Optional[Report]:
        """Tìm báo cáo kèm thông tin tin đăng và người báo cáo."""
        stmt = (
            select(Report)
            .options(
                selectinload(Report.listing).selectinload(Listing.photos),
                selectinload(Report.listing).selectinload(Listing.seller),
                selectinload(Report.reporter),
            )
            .where(Report.report_id == report_id)
        )
        res = await db.execute(stmt)
        return res.scalar_one_or_none()

    async def find_queue(
        self,
        db: AsyncSession,
        status: str = "new",
    ) -> List[Report]:
        """
        Lấy danh sách báo cáo theo trạng thái (mặc định 'new').
        Tận dụng chỉ mục idx_reports_queue trên cột (status, created_at).
        """
        stmt = (
            select(Report)
            .options(
                selectinload(Report.listing).selectinload(Listing.photos),
                selectinload(Report.listing).selectinload(Listing.seller),
                selectinload(Report.reporter),
            )
            .where(Report.status == status)
            .order_by(Report.created_at.asc())
        )
        res = await db.execute(stmt)
        return res.scalars().all()
