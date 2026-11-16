"""
Pydantic Schemas for Reports and Admin Report Moderation (SDD 6.1, 7.2, UC-08, UC-09, FR-12, FR-15).
"""

from typing import Optional
from datetime import datetime
from app.schemas.health import BaseSchema

REASON_LABELS = {
    "wrong_score": "Sai điểm tình trạng",
    "scam": "Lừa đảo",
    "prohibited": "Hàng cấm kinh doanh",
    "other": "Lý do khác",
}


class ReportCreateRequest(BaseSchema):
    """Schema người dùng gửi báo cáo vi phạm tin đăng (UC-08, FR-12)."""
    reason: str
    note: Optional[str] = None


class ReportResolveRequest(BaseSchema):
    """Schema admin xử lý báo cáo vi phạm (UC-09, FR-15). Action: hide hoặc dismiss."""
    action: str


class ReportAdminItem(BaseSchema):
    """Schema báo cáo trong hàng đợi kiểm duyệt của Admin (UC-09, FR-15)."""
    id: int
    report_id: int
    listing_id: int
    listing_title: Optional[str] = None
    listing_price: Optional[float] = None
    listing_status: Optional[str] = None
    listing_thumbnail: Optional[str] = None
    seller_id: Optional[int] = None
    seller_name: Optional[str] = None
    reporter_id: int
    reporter_name: Optional[str] = None
    reporter_email: Optional[str] = None
    reason: str
    reason_label: Optional[str] = None
    note: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None


class ReportCreateResponse(BaseSchema):
    """Schema phản hồi khi gửi báo cáo thành công."""
    report_id: int
    listing_id: int
    status: str = "new"
    message: str = "Đã gửi báo cáo thành công, Admin sẽ kiểm duyệt."


class ReportResolveResponse(BaseSchema):
    """Schema phản hồi khi Admin xử lý báo cáo."""
    report_id: int
    action: str
    status: str
    listing_status: Optional[str] = None
    message: str
