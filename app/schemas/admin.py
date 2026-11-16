from typing import Any, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field, model_validator
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


class ScoreAdjustments(BaseSchema):
    """Điểm điều chỉnh khi Admin hạ điểm (hỗ trợ cả snake_case và camelCase/short names)."""
    score_appearance: Optional[float] = Field(None, ge=0.0, le=10.0)
    score_function: Optional[float] = Field(None, ge=0.0, le=10.0)
    score_accessories: Optional[float] = Field(None, ge=0.0, le=10.0)

    @model_validator(mode="before")
    @classmethod
    def populate_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Hỗ trợ appearance / scoreAppearance
            if "appearance" in data and "score_appearance" not in data and "scoreAppearance" not in data:
                data["score_appearance"] = data["appearance"]
            # Hỗ trợ function / scoreFunction
            if "function" in data and "score_function" not in data and "scoreFunction" not in data:
                data["score_function"] = data["function"]
            # Hỗ trợ accessories / scoreAccessories
            if "accessories" in data and "score_accessories" not in data and "scoreAccessories" not in data:
                data["score_accessories"] = data["accessories"]
        return data


class ApproveListingRequest(BaseSchema):
    """Yêu cầu duyệt tin đăng kèm hạ điểm nếu có."""
    adjustments: Optional[ScoreAdjustments] = None
    note: Optional[str] = None
    review_note: Optional[str] = None

    @model_validator(mode="before")
    @classmethod
    def populate_note(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "review_note" in data and "note" not in data:
                data["note"] = data["review_note"]
            elif "reviewNote" in data and "note" not in data:
                data["note"] = data["reviewNote"]
        return data


class RejectListingRequest(BaseSchema):
    """Yêu cầu từ chối tin đăng kèm lý do bắt buộc."""
    reason: Optional[str] = Field(None, description="Lý do từ chối tin đăng")
    reject_reason: Optional[str] = Field(None, description="Alias cho lý do từ chối")

    @model_validator(mode="before")
    @classmethod
    def populate_reason(cls, data: Any) -> Any:
        if isinstance(data, dict):
            if "reject_reason" in data and not data.get("reason"):
                data["reason"] = data["reject_reason"]
            elif "rejectReason" in data and not data.get("reason"):
                data["reason"] = data["rejectReason"]
        return data


class ModerationActionResponse(BaseSchema):
    """Kết quả sau khi duyệt hoặc từ chối tin đăng."""
    id: int
    status: str
    total_score: float
    rank: str
    message: str
    reviewed_by: Optional[int] = None
    reviewed_at: Optional[datetime] = None
    reject_reason: Optional[str] = None
    review_note: Optional[str] = None
    note: Optional[str] = None
