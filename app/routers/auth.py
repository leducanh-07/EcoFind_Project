"""
Authentication Router (SDD 4, SDD 7.2, UC-01).
Endpoints for registration and login.
"""

from fastapi import APIRouter, Depends, status
from sqlalchemy.ext.asyncio import AsyncSession
from app.core.database import get_db
from app.schemas.auth import LoginRequest, TokenResponse
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["Authentication"])
auth_service = AuthService()


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
