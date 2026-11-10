"""
Pydantic Schemas for Authentication (SDD 7.1, 7.2, UC-01).
"""

from typing import Optional
from pydantic import EmailStr, Field
from app.schemas.health import BaseSchema


class LoginRequest(BaseSchema):
    """Payload đăng nhập tài khoản."""
    email: EmailStr = Field(..., description="Email đăng nhập của người dùng")
    password: str = Field(..., min_length=1, description="Mật khẩu tài khoản")


class RegisterRequest(BaseSchema):
    """Payload đăng ký tài khoản (FR-01, SDD 7.2)."""
    full_name: str = Field(..., min_length=2, max_length=100, description="Họ và tên")
    email: EmailStr = Field(..., description="Email đăng ký của người dùng")
    phone: str = Field(..., min_length=8, max_length=20, description="Số điện thoại liên hệ")
    password: str = Field(..., min_length=8, max_length=100, description="Mật khẩu tối thiểu 8 ký tự")


class UserBasicInfo(BaseSchema):
    """Thông tin cơ bản của người dùng sau khi đăng nhập / đăng ký."""
    user_id: int
    full_name: str
    email: str
    role: str
    phone: Optional[str] = None


class TokenResponse(BaseSchema):
    """Phản hồi sau khi đăng nhập / đăng ký thành công kèm JWT và role."""
    access_token: str
    token_type: str = "bearer"
    role: str
    user: Optional[UserBasicInfo] = None
