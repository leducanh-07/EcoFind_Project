from typing import List, Optional
from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.dependencies import require_role
from app.models.user import User
from app.schemas.admin import (
    AdminListingDetailResponse,
    AdminListingItem,
    ApproveListingRequest,
    ModerationActionResponse,
    RejectListingRequest,
)
from app.services.moderation_service import ModerationService

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
    request: RejectListingRequest,
    current_admin: User = Depends(require_role("admin")),
    db: AsyncSession = Depends(get_db),
):
    """
    Từ chối tin đăng không hợp lệ:
      - Bắt buộc phải có lý do từ chối (trả về 400 nếu để trống).
      - Cập nhật trạng thái tin thành bị từ chối (rejected).
      - Trả về mã lỗi 409 nếu tin đăng đã được xử lý trước đó.
    """
    return await moderation_service.reject_listing(
        db,
        listing_id=listing_id,
        admin_id=current_admin.user_id,
        reason=request.reason,
    )
