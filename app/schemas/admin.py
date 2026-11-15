from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field
from app.schemas.health import BaseSchema
from app.schemas.listing import PhotoItem


class AdminSellerInfo(BaseSchema):
    """Thông tin người bán phục vụ giao diện Admin."""
    user_id: int
    full_name: str
    email: str
    phone: Optional[str] = None


class AdminListingItem(BaseSchema):
    """Thông tin tin đăng trong hàng đợi duyệt."""
    id: int
    title: str
    price: float
    category_id: int
    category_name: Optional[str] = None
    seller_id: int
    seller_name: str
    seller_email: Optional[str] = None
    seller_phone: Optional[str] = None
    score_appearance: float
    score_function: float
    score_accessories: float
    total_score: float
    rank: str
    status: str
    address: str
    thumbnail_url: Optional[str] = None
    photos: List[PhotoItem] = []
    created_at: datetime
    reject_reason: Optional[str] = None
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None


class AdminListingDetailResponse(BaseSchema):
    """Chi tiết đầy đủ tin đăng cho Admin kiểm duyệt."""
    id: int
    title: str
    description: str
    price: float
    address: str
    lat: float
    lng: float
    category_id: int
    category_name: Optional[str] = None
    seller: AdminSellerInfo
    score_appearance: float
    score_function: float
    score_accessories: float
    total_score: float
    rank: str
    status: str
    photos: List[PhotoItem] = []
    created_at: datetime
    reject_reason: Optional[str] = None
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None


class ScoreAdjustments(BaseModel):
    """Điểm điều chỉnh khi Admin hạ điểm."""
    score_appearance: Optional[float] = Field(None, ge=0.0, le=10.0)
    score_function: Optional[float] = Field(None, ge=0.0, le=10.0)
    score_accessories: Optional[float] = Field(None, ge=0.0, le=10.0)


class ApproveListingRequest(BaseModel):
    """Yêu cầu duyệt tin đăng kèm hạ điểm nếu có."""
    adjustments: Optional[ScoreAdjustments] = None
    note: Optional[str] = None


class RejectListingRequest(BaseModel):
    """Yêu cầu từ chối tin đăng kèm lý do bắt buộc."""
    reason: str = Field(..., min_length=1, description="Lý do từ chối tin đăng")


class ModerationActionResponse(BaseSchema):
    """Kết quả sau khi duyệt hoặc từ chối tin đăng."""
    id: int
    status: str
    total_score: float
    rank: str
    message: str
    reviewed_at: Optional[datetime] = None
    reject_reason: Optional[str] = None
