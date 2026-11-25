"""
Pydantic Schemas for User Profile & Public Seller Profile (Strictly SDD 6.1 fields + derived stats).
"""

from typing import List, Optional
from pydantic import Field
from app.schemas.health import BaseSchema
from app.schemas.listing import ListingMapItem


class CategorySummary(BaseSchema):
    """Tổng hợp số lượng tin theo danh mục của người bán."""
    name: str
    count: int


class AdminSystemStats(BaseSchema):
    """Thống kê điều phối & kiểm duyệt dành cho Quản trị viên."""
    pending_listings_count: int = 0
    active_selling_count: int = 0
    open_reports_count: int = 0
    total_members_count: int = 0


class MyProfileStats(BaseSchema):
    """Thống kê hoạt động cá nhân tổng hợp từ các bảng SDD 6.1."""
    selling_count: int = 0
    pending_count: int = 0
    sold_count: int = 0
    total_listings: int = 0
    favorites_count: int = 0
    reports_count: int = 0
    avg_score: Optional[float] = None


class MyProfileResponse(BaseSchema):
    """Thông tin hồ sơ cá nhân của tài khoản đang đăng nhập."""
    user_id: int
    full_name: str
    email: str
    phone: Optional[str] = None
    role: str
    failed_attempts: int = 0
    is_locked: bool = False
    activity_role: str
    top_categories: List[CategorySummary] = []
    stats: MyProfileStats = MyProfileStats()
    admin_stats: Optional[AdminSystemStats] = None
    featured_listings: List[ListingMapItem] = []


class ProfileUpdateRequest(BaseSchema):
    """Payload cập nhật thông tin cá nhân chuẩn SDD 6.1 (/api/me/profile)."""
    full_name: str = Field(..., min_length=2, max_length=100, description="Họ và tên")
    phone: Optional[str] = Field(None, max_length=20, description="Số điện thoại liên hệ")


class ChangePasswordRequest(BaseSchema):
    """Payload đổi mật khẩu áp dụng cho mọi tài khoản (/api/me/password)."""
    current_password: str = Field(..., min_length=1, description="Mật khẩu hiện tại")
    new_password: str = Field(..., min_length=8, max_length=100, description="Mật khẩu mới tối thiểu 8 ký tự")
    confirm_password: str = Field(..., min_length=8, max_length=100, description="Xác nhận mật khẩu mới")


class PublicSellerStats(BaseSchema):
    """Thống kê uy tín công khai của người bán."""
    selling_count: int = 0
    sold_count: int = 0
    avg_score: Optional[float] = None


class PublicSellerProfileResponse(BaseSchema):
    """Hồ sơ công khai của người bán kèm chuyên mục nổi bật và tin đang bán."""
    user_id: int
    full_name: str
    role: str
    activity_role: str
    top_categories: List[CategorySummary] = []
    stats: PublicSellerStats = PublicSellerStats()
    listings: List[ListingMapItem] = []
