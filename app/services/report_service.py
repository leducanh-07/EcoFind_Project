"""
Report Service (SDD 4, 7.2, UC-08, UC-09, FR-12, FR-15).
Handles violation reporting by users and report moderation by admins.
"""

from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.exceptions import (
    BadRequestException,
    NotFoundException,
    ForbiddenException,
    ConflictException,
)
from app.models.user import User
from app.repositories.report_repository import ReportRepository
from app.repositories.listing_repository import ListingRepository
from app.schemas.report import (
    ReportAdminItem,
    ReportCreateResponse,
    ReportResolveResponse,
    REASON_LABELS,
)

VALID_REASONS = {"wrong_score", "scam", "prohibited", "other"}
VALID_ACTIONS = {"hide", "dismiss"}


class ReportService:
    """Service xử lý báo cáo vi phạm và kiểm duyệt báo cáo của Admin."""

    def __init__(
        self,
        report_repo: Optional[ReportRepository] = None,
        listing_repo: Optional[ListingRepository] = None,
    ):
        self.report_repo = report_repo or ReportRepository()
        self.listing_repo = listing_repo or ListingRepository()

    async def create_report(
        self,
        db: AsyncSession,
        *,
        listing_id: int,
        reporter: User,
        reason: str,
        note: Optional[str] = None,
    ) -> ReportCreateResponse:
        """
        Người dùng gửi báo cáo vi phạm (UC-08, FR-12, TC-09):
          - reason thuộc {wrong_score, scam, prohibited, other}.
          - note tối đa 200 ký tự (quá dài trả 400).
          - Báo cáo tin của chính mình trả 403 (TC-09).
          - Báo cáo lần 2 cùng tin trả 409 (TC-09).
        """
        clean_reason = (reason or "").strip().lower()
        if clean_reason not in VALID_REASONS:
            raise BadRequestException(
                message=f"Lý do báo cáo '{reason}' không hợp lệ. Chỉ chấp nhận: {', '.join(sorted(VALID_REASONS))}",
                fields={"reason": f"Chấp nhận: {', '.join(sorted(VALID_REASONS))}"},
            )

        clean_note = (note or "").strip() if note else None
        if clean_note and len(clean_note) > 200:
            raise BadRequestException(
                message="Ghi chú báo cáo không được vượt quá 200 ký tự",
                fields={"note": "Ghi chú tối đa 200 ký tự"},
            )

        listing = await self.listing_repo.find_by_id(db, listing_id)
        if not listing:
            raise NotFoundException(message="Tin đăng không tồn tại", code=404)

        # TC-09: Báo cáo tin của chính mình trả 403 Forbidden
        if listing.seller_id == reporter.user_id:
            raise ForbiddenException(
                message="Bạn không thể tự báo cáo tin đăng của chính mình",
                code=403,
            )

        # TC-09: Báo cáo cùng một tin lần 2 trả 409 Conflict
        existing = await self.report_repo.find_by_reporter_and_listing(
            db, reporter_id=reporter.user_id, listing_id=listing_id
        )
        if existing:
            raise ConflictException(
                message="Bạn đã báo cáo tin đăng này trước đó rồi",
                code=409,
            )

        report = await self.report_repo.create_report(
            db,
            listing_id=listing_id,
            reporter_id=reporter.user_id,
            reason=clean_reason,
            note=clean_note,
        )

        return ReportCreateResponse(
            report_id=report.report_id,
            listing_id=listing_id,
            status="new",
            message="Đã gửi báo cáo vi phạm thành công, Quản trị viên sẽ xử lý.",
        )

    async def get_reports_queue(
        self,
        db: AsyncSession,
        *,
        status: str = "new",
    ) -> List[ReportAdminItem]:
        """
        Lấy danh sách báo cáo vi phạm theo trạng thái cho Admin (UC-09, FR-15).
        Tận dụng chỉ mục idx_reports_queue.
        """
        reports = await self.report_repo.find_queue(db, status=status)
        results = []
        for r in reports:
            l = r.listing
            photos = sorted(l.photos or [], key=lambda p: p.sort_order) if l else []
            thumb = photos[0].url if photos else None

            results.append(
                ReportAdminItem(
                    id=r.report_id,
                    report_id=r.report_id,
                    listing_id=r.listing_id,
                    listing_title=l.title if l else None,
                    listing_price=float(l.price) if l else None,
                    listing_status=l.status if l else None,
                    listing_thumbnail=thumb,
                    seller_id=l.seller_id if l else None,
                    seller_name=l.seller.full_name if l and l.seller else None,
                    reporter_id=r.reporter_id,
                    reporter_name=r.reporter.full_name if r.reporter else None,
                    reporter_email=r.reporter.email if r.reporter else None,
                    reason=r.reason,
                    reason_label=REASON_LABELS.get(r.reason, r.reason),
                    note=r.note,
                    status=r.status,
                    created_at=r.created_at,
                )
            )
        return results

    async def resolve_report(
        self,
        db: AsyncSession,
        *,
        report_id: int,
        admin: User,
        action: str,
    ) -> ReportResolveResponse:
        """
        Admin xử lý báo cáo vi phạm (UC-09, FR-15):
          - action = 'hide': chuyển tin sang hidden, hidden_by_admin = True, báo cáo sang resolved.
          - action = 'dismiss': chỉ đóng báo cáo sang resolved.
          - Báo cáo đã xử lý trả 409 Conflict.
        """
        clean_action = (action or "").strip().lower()
        if clean_action not in VALID_ACTIONS:
            raise BadRequestException(
                message=f"Hành động '{action}' không hợp lệ. Chỉ chấp nhận: hide, dismiss",
                fields={"action": "Chấp nhận: hide, dismiss"},
            )

        report = await self.report_repo.find_by_id_with_relations(db, report_id)
        if not report:
            raise NotFoundException(message="Báo cáo không tồn tại", code=404)

        if report.status == "resolved":
            raise ConflictException(
                message="Báo cáo này đã được xử lý trước đó rồi",
                code=409,
            )

        listing = report.listing
        listing_status = listing.status if listing else None

        if clean_action == "hide":
            if listing:
                listing.status = "hidden"
                listing.hidden_by_admin = True
                listing_status = "hidden"
            report.status = "resolved"
            msg = "Đã ẩn tin đăng vi phạm và hoàn tất xử lý báo cáo."
        else:  # dismiss
            report.status = "resolved"
            msg = "Đã bỏ qua báo cáo vi phạm."

        await db.commit()
        await db.refresh(report)

        return ReportResolveResponse(
            report_id=report.report_id,
            action=clean_action,
            status=report.status,
            listing_status=listing_status,
            message=msg,
        )


report_service = ReportService()
