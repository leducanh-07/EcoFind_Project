from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.user import User
from app.schemas.admin import (
    AdminDashboardStatsResponse,
    AdminHideRestoreRequest,
    AdminListingDetailResponse,
    AdminListingItem,
    AdminUserItem,
    AdminUserLockRequest,
    AdminUserLockResponse,
    ApproveListingRequest,
    ModerationActionResponse,
    RejectListingRequest,
)
from app.schemas.report import (
    ReportAdminItem,
    ReportResolveRequest,
    ReportResolveResponse,
)
from app.services.moderation_service import ModerationService
from app.services.report_service import report_service
from app.services.user_service import user_service

router = APIRouter(prefix="/admin", tags=["Admin Moderation"])
moderation_service = ModerationService()


@router.get(
    "/listings",
    response_model=List[AdminListingItem],
    status_code=status.HTTP_200_OK,
    summary="Lấy danh sách tin đăng trong hàng đợi kiểm duyệt của Admin",
)
async def get_admin_listings_queue(
    status_filter: Optional[str] = Query(
        "pending",
        alias="status",
        description="Lọc theo trạng thái tin đăng (mặc định: pending)",
    ),
    sort: Optional[str] = Query(
        "asc",
        description="Thứ tự sắp xếp theo ngày gửi (asc: cũ nhất trước, desc: mới nhất trước)",
    ),
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Xem danh sách tin đăng trong hàng đợi kiểm duyệt:
      - Yêu cầu quyền quản trị viên (Admin).
      - Mặc định lọc các tin ở trạng thái chờ duyệt (pending).
      - Sắp xếp theo thời gian tạo (created_at).
    """
    return await moderation_service.get_listings_queue(
        db, status=status_filter, sort=sort or "asc"
    )


@router.get(
    "/listings/{listing_id}",
    response_model=AdminListingDetailResponse,
    status_code=status.HTTP_200_OK,
    summary="Xem thông tin chi tiết tin đăng chờ duyệt",
)
async def get_admin_listing_detail(
    listing_id: int,
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Xem toàn bộ thông tin chi tiết một tin đăng:
      - Yêu cầu quyền quản trị viên (Admin).
      - Bao gồm hình ảnh thực tế, mô tả, vị trí, người bán và 3 điểm thành phần tự chấm.
    """
    return await moderation_service.get_listing_detail(db, listing_id)


@router.post(
    "/listings/{listing_id}/approve",
    response_model=ModerationActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Duyệt tin đăng và điều chỉnh hạ điểm nếu có",
)
async def approve_listing(
    listing_id: int,
    request: Optional[ApproveListingRequest] = None,
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Duyệt tin đăng chuyển sang trạng thái đang bán:
      - Cho phép điều chỉnh hạ 3 điểm thành phần nếu người bán tự chấm cao hơn thực tế.
      - Tự động tính lại điểm tổng và phân hạng chất lượng mới.
      - Ghi nhận quản trị viên duyệt và thời gian duyệt.
      - Trả về mã lỗi 409 nếu tin đăng đã được xử lý trước đó.
    """
    adjustments = request.adjustments if request else None
    note = (request.note or request.review_note) if request else None
    return await moderation_service.approve_listing(
        db,
        listing_id=listing_id,
        admin_id=current_admin.user_id,
        adjustments=adjustments,
        note=note,
    )


@router.post(
    "/listings/{listing_id}/reject",
    response_model=ModerationActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Từ chối tin đăng vi phạm kèm lý do",
)
async def reject_listing(
    listing_id: int,
    request: Optional[RejectListingRequest] = None,
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Từ chối tin đăng không hợp lệ:
      - Bắt buộc phải có lý do từ chối (trả về 400 nếu để trống).
      - Cập nhật trạng thái tin thành bị từ chối (rejected).
      - Trả về mã lỗi 409 nếu tin đăng đã được xử lý trước đó.
    """
    reason = (request.reason or request.reject_reason) if request else ""
    return await moderation_service.reject_listing(
        db,
        listing_id=listing_id,
        admin_id=current_admin.user_id,
        reason=reason,
    )


@router.get(
    "/reports",
    response_model=List[ReportAdminItem],
    status_code=status.HTTP_200_OK,
    summary="Lấy danh sách báo cáo vi phạm trong hàng đợi",
)
async def get_admin_reports_queue(
    status_filter: Optional[str] = Query(
        "new",
        alias="status",
        description="Lọc theo trạng thái báo cáo (mặc định: new)",
    ),
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Xem danh sách báo cáo vi phạm trong hàng đợi xử lý:
      - Yêu cầu quyền quản trị viên (Admin).
      - Mặc định lọc các báo cáo ở trạng thái mới (new).
    """
    return await report_service.get_reports_queue(
        db, status=status_filter or "new"
    )


@router.post(
    "/reports/{report_id}/resolve",
    response_model=ReportResolveResponse,
    status_code=status.HTTP_200_OK,
    summary="Xử lý báo cáo vi phạm (ẩn tin hoặc bỏ qua)",
)
async def resolve_admin_report(
    report_id: int,
    request: ReportResolveRequest,
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Quản trị viên xử lý báo cáo vi phạm:
      - action = 'hide': ẩn tin đăng vi phạm và đánh dấu đã xử lý.
      - action = 'dismiss': bỏ qua báo cáo và đánh dấu đã xử lý.
      - Báo cáo đã xử lý trả về mã lỗi 409.
    """
    return await report_service.resolve_report(
        db,
        report_id=report_id,
        admin=current_admin,
        action=request.action,
    )


@router.get(
    "/stats",
    response_model=AdminDashboardStatsResponse,
    status_code=status.HTTP_200_OK,
    summary="Lấy số liệu thống kê tổng quan & phân bổ danh mục cho Admin",
)
async def get_admin_dashboard_stats(
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Lấy số liệu KPI toàn sàn phục vụ bảng điều khiển Quản trị viên."""
    return await moderation_service.get_dashboard_stats(db)


@router.post(
    "/listings/{listing_id}/hide",
    response_model=ModerationActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin ẩn trực tiếp tin đăng vi phạm khỏi bản đồ",
)
async def hide_listing_by_admin(
    listing_id: int,
    request: Optional[AdminHideRestoreRequest] = None,
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Ẩn tin đăng đang bán hoặc vi phạm (đánh dấu hidden_by_admin = True)."""
    reason = request.reason if request else None
    return await moderation_service.hide_listing(
        db,
        listing_id=listing_id,
        admin_id=current_admin.user_id,
        reason=reason,
    )


@router.post(
    "/listings/{listing_id}/restore",
    response_model=ModerationActionResponse,
    status_code=status.HTTP_200_OK,
    summary="Admin khôi phục tin đăng đang ẩn về lại Đang bán",
)
async def restore_listing_by_admin(
    listing_id: int,
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Khôi phục tin đăng đang ẩn về trạng thái selling."""
    return await moderation_service.restore_listing(
        db,
        listing_id=listing_id,
        admin_id=current_admin.user_id,
    )


@router.get(
    "/users",
    response_model=List[AdminUserItem],
    status_code=status.HTTP_200_OK,
    summary="Lấy danh sách tài khoản thành viên kèm thống kê hoạt động",
)
async def get_admin_users(
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Lấy danh sách thành viên để Admin theo dõi, khóa hoặc mở khóa tài khoản."""
    return await user_service.get_admin_users_list(db)


@router.post(
    "/users/{user_id}/lock",
    response_model=AdminUserLockResponse,
    status_code=status.HTTP_200_OK,
    summary="Khóa tài khoản người dùng theo thời hạn",
)
async def lock_user_account(
    user_id: int,
    payload: AdminUserLockRequest,
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Khóa tài khoản thành viên bằng cột locked_until (chặn khóa tài khoản Admin)."""
    return await user_service.lock_user_by_admin(
        db,
        target_user_id=user_id,
        admin=current_admin,
        duration_hours=payload.duration_hours,
    )


@router.post(
    "/users/{user_id}/unlock",
    response_model=AdminUserLockResponse,
    status_code=status.HTTP_200_OK,
    summary="Mở khóa tài khoản người dùng",
)
async def unlock_user_account(
    user_id: int,
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """Mở khóa ngay lập tức tài khoản đang bị khóa (xóa locked_until và failed_attempts)."""
    return await user_service.unlock_user_by_admin(db, target_user_id=user_id)

