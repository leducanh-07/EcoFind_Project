"""
Authentication Service (SDD 4, UC-01, FR-02, NFR-SEC-01, TC-01).
Handles login, password verification, 15-minute account lockout after 5 failed attempts, and JWT token issuance.
"""

from datetime import datetime, timedelta, timezone
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from app.repositories.user_repository import UserRepository
from app.schemas.auth import LoginRequest, TokenResponse, UserBasicInfo
from app.core.security import verify_password, create_access_token
from app.core.exceptions import UnauthorizedException, LockedException


class AuthService:
    """Service xử lý nghiệp vụ xác thực người dùng và khóa tài khoản bảo vệ."""

    def __init__(self, user_repo: Optional[UserRepository] = None):
        self.user_repo = user_repo or UserRepository()

    async def login(self, db: AsyncSession, login_data: LoginRequest) -> TokenResponse:
        """
        Đăng nhập người dùng bằng email và mật khẩu (UC-01, FR-02, TC-01):
          - Đếm failed_attempts; lần sai thứ 5 đặt locked_until = hiện tại + 15 phút.
          - Trong thời gian khóa trả HTTP 423 kể cả khi nhập đúng hoặc sai.
          - Hết 15 phút khóa, tự động mở khóa và reset bộ đếm failed_attempts.
          - Đăng nhập đúng: đặt lại failed_attempts = 0 và locked_until = None.
          - Sai thông tin trả HTTP 401 với thông báo chung 'Email hoặc mật khẩu không đúng'.
          - Cấp JWT Token có thời hạn và trả về vai trò (role).
        """
        user = await self.user_repo.find_by_email(db, login_data.email)
        now = datetime.now(timezone.utc)
        generic_error_msg = "Email hoặc mật khẩu không đúng"

        if user is None:
            raise UnauthorizedException(message=generic_error_msg)

        # 1. Kiểm tra trạng thái khóa tài khoản 15 phút (TC-01, FR-02)
        if user.locked_until:
            locked_until = user.locked_until
            if locked_until.tzinfo is None:
                locked_until = locked_until.replace(tzinfo=timezone.utc)

            if locked_until > now:
                # Vẫn đang trong thời gian khóa: chặn đăng nhập kể cả nhập đúng
                raise LockedException(
                    message="Tài khoản tạm thời bị khóa 15 phút do nhập sai mật khẩu quá 5 lần"
                )
            else:
                # Đã hết thời gian khóa 15 phút: tự động mở khóa và đặt lại bộ đếm
                user.locked_until = None
                user.failed_attempts = 0
                await self.user_repo.update(db, user)

        # 2. So khớp mật khẩu với hash bcrypt
        is_password_valid = verify_password(login_data.password, user.password_hash)

        if not is_password_valid:
            # Tăng số lần đăng nhập sai liên tiếp
            user.failed_attempts += 1

            # Lần sai thứ 5: kích hoạt khóa tài khoản 15 phút (TC-01, FR-02)
            if user.failed_attempts >= 5:
                user.locked_until = now + timedelta(minutes=15)
                await self.user_repo.update(db, user)
                raise LockedException(
                    message="Tài khoản tạm thời bị khóa 15 phút do nhập sai mật khẩu quá 5 lần"
                )

            await self.user_repo.update(db, user)
            raise UnauthorizedException(message=generic_error_msg)

        # 3. Đăng nhập đúng: đặt lại toàn bộ trạng thái khóa và số lần thử sai
        if user.failed_attempts > 0 or user.locked_until is not None:
            user.failed_attempts = 0
            user.locked_until = None
            await self.user_repo.update(db, user)

        # 4. Cấp JWT Access Token có thời hạn
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
