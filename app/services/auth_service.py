"""
Authentication Service (SDD 4, UC-01, FR-02, NFR-SEC-01).
Handles login, password verification, account lockout, and JWT token issuance.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, TokenResponse, UserBasicInfo
from app.core.security import verify_password, create_access_token
from app.core.exceptions import UnauthorizedException, LockedException


class AuthService:
    """Service xử lý nghiệp vụ xác thực người dùng."""

    def __init__(self, user_repo: Optional[UserRepository] = None):
        self.user_repo = user_repo or UserRepository()

    async def login(self, db: AsyncSession, login_data: LoginRequest) -> TokenResponse:
        """
        Đăng nhập người dùng bằng email và mật khẩu:
          - Kiểm tra khóa tài khoản 15 phút sau 5 lần sai (HTTP 423).
          - Kiểm tra thông tin (sai trả HTTP 401 không lộ rõ sai email hay mật khẩu).
          - Cấp JWT Token có thời hạn và trả về vai trò (role).
        """
        user = await self.user_repo.find_by_email(db, login_data.email)
        now = datetime.now(timezone.utc)

        # Thông báo lỗi chung bảo mật theo tiêu chí chấp nhận FR-02
        generic_error_msg = "Email hoặc mật khẩu không đúng"

        if user is None:
            raise UnauthorizedException(message=generic_error_msg)

        # 1. Kiểm tra tài khoản có đang bị khóa hay không
        if user.locked_until:
            locked_until = user.locked_until
            if locked_until.tzinfo is None:
                locked_until = locked_until.replace(tzinfo=timezone.utc)

            if locked_until > now:
                raise LockedException(
                    message="Tài khoản tạm thời bị khóa 15 phút do nhập sai mật khẩu quá 5 lần"
                )

        # 2. So khớp mật khẩu với hash bcrypt
        is_password_valid = verify_password(login_data.password, user.password_hash)

        if not is_password_valid:
            # Tăng số lần đăng nhập sai
            user.failed_attempts += 1

            # Lần sai thứ 5: khóa tài khoản 15 phút (TC-01, FR-02)
            if user.failed_attempts >= 5:
                user.locked_until = now + timedelta(minutes=15)
                await self.user_repo.update(db, user)
                raise LockedException(
                    message="Tài khoản tạm thời bị khóa 15 phút do nhập sai mật khẩu quá 5 lần"
                )

            await self.user_repo.update(db, user)
            raise UnauthorizedException(message=generic_error_msg)

        # 3. Đăng nhập đúng: đặt lại số lần thử sai và mở khóa
        if user.failed_attempts > 0 or user.locked_until is not None:
            user.failed_attempts = 0
            user.locked_until = None
            await self.user_repo.update(db, user)

        # 4. Sinh JWT Access Token có thời hạn
        token_payload = {
            "sub": str(user.user_id),
            "email": user.email,
            "role": user.role,
            "fullName": user.full_name,
        }
        access_token = create_access_token(token_payload)

        return TokenResponse(
            access_token=access_token,
            token_type="bearer",
            role=user.role,
            user=UserBasicInfo(
                user_id=user.user_id,
                full_name=user.full_name,
                email=user.email,
                role=user.role,
                phone=user.phone,
            ),
        )
