"""
Authentication Router (SDD 4, SDD 7.2, UC-01).
Endpoints for registration and login.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.auth import LoginRequest, RegisterRequest, TokenResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])
auth_service = AuthService()


@router.post(
    "/register",
    response_model=TokenResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Đăng ký tài khoản người dùng mới",
)
async def register(
    register_data: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Đăng ký tài khoản bằng họ tên, email, số điện thoại, mật khẩu:
      - Trả về mã HTTP 201 kèm JWT access_token và role = user.
      - Trả 409 nếu email đã tồn tại.
      - Trả 400 nếu dữ liệu không hợp lệ hoặc mật khẩu dưới 8 ký tự.
    """
    return await auth_service.register(db, register_data)


@router.post(
    "/login",
    response_model=TokenResponse,
    status_code=status.HTTP_200_OK,
    summary="Đăng nhập tài khoản & nhận JWT token",
)
async def login(
    login_data: LoginRequest,
    db: AsyncSession = Depends(get_db),
):
    """
    Đăng nhập bằng email và mật khẩu:
      - Trả về mã HTTP 200 kèm access_token và role.
      - Sai thông tin trả HTTP 401 với thông báo chung 'Email hoặc mật khẩu không đúng'.
      - Nhập sai quá 5 lần liên tiếp trả HTTP 423 (tài khoản tạm khóa 15 phút).
    """
    return await auth_service.login(db, login_data)
