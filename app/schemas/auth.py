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


class UserBasicInfo(BaseSchema):
    """Thông tin cơ bản của người dùng sau khi đăng nhập."""
    user_id: int
    full_name: str
    email: str
    role: str
    phone: Optional[str] = None


class TokenResponse(BaseSchema):
    """Phản hồi sau khi đăng nhập thành công kèm JWT và role."""
    access_token: str
    token_type: str = "bearer"
    role: str
    user: Optional[UserBasicInfo] = None
