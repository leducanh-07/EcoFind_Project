"""
Authentication & Authorization Dependencies (SDD 2.1, 4, NFR-SEC-03, TC-08, TC-10).
Provides get_current_user, require_role, get_optional_user, and check_listing_owner.
"""

from typing import Any, Callable, Optional
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.ext.asyncio import AsyncSession
import jwt

from app.core.database import get_db
from app.core.exceptions import UnauthorizedException, ForbiddenException
from app.core.security import decode_access_token
from app.models.user import User
from app.repositories.user_repository import UserRepository

# HTTPBearer với auto_error=False để tự điều khiển thông báo lỗi và hỗ trợ get_optional_user
http_bearer = HTTPBearer(auto_error=False)
user_repo = UserRepository()


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    Dependency xác thực JWT Token bắt buộc (UC-01, NFR-SEC-03):
      - 401 khi thiếu token hoặc token không hợp lệ / hết hạn.
      - Trả về đối tượng User hiện tại nếu token hợp lệ.
    """
    if not credentials or not credentials.credentials:
        raise UnauthorizedException(message="Chưa đăng nhập hoặc thiếu token xác thực")

    token = credentials.credentials
    try:
        payload = decode_access_token(token)
        user_id_str = payload.get("sub")
        if not user_id_str:
            raise UnauthorizedException(message="Token không chứa thông tin định danh")
        user_id = int(user_id_str)
    except jwt.ExpiredSignatureError:
        raise UnauthorizedException(message="Phiên làm việc (token) đã hết hạn")
    except (jwt.PyJWTError, ValueError):
        raise UnauthorizedException(message="Token xác thực không hợp lệ")

    user = await user_repo.find_by_id(db, user_id)
    if not user:
        raise UnauthorizedException(message="Người dùng không tồn tại hoặc đã bị xóa")

    return user


async def get_optional_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(http_bearer),
    db: AsyncSession = Depends(get_db),
) -> Optional[User]:
    """
    Dependency đọc token tùy chọn cho endpoint dành cho 'Mọi người' (FR-07, TC-04):
      - Có token hợp lệ -> Trả về User (để hiển thị số điện thoại, trạng thái yêu thích...).
      - Không có token hoặc token sai/hết hạn -> Trả về None mà không chặn request.
    """
    if not credentials or not credentials.credentials:
        return None

    try:
        payload = decode_access_token(credentials.credentials)
        user_id_str = payload.get("sub")
        if not user_id_str:
            return None
        user_id = int(user_id_str)
        user = await user_repo.find_by_id(db, user_id)
        return user
    except Exception:
        return None


def require_role(required_role: str) -> Callable:
    """
    Kiểm tra phân quyền theo vai trò (Role-Based Access Control, NFR-SEC-03, TC-10):
      - Người dùng thông thường (role = 'user') gọi endpoint yêu cầu 'admin' sẽ nhận HTTP 403.
    """
    async def role_checker(
        current_user: User = Depends(get_current_user),
    ) -> User:
        if current_user.role != required_role:
            raise ForbiddenException(
                message=f"Chức năng này yêu cầu quyền '{required_role}'"
            )
        return current_user

    return role_checker


def check_listing_owner(user: User, listing_or_seller_id: Any) -> None:
    """
    Kiểm tra quyền sở hữu tin đăng (NFR-SEC-03, TC-08):
      - Chỉ chủ tin (seller_id == user_id) hoặc Admin mới có quyền sửa/xóa/đổi trạng thái tin.
      - Người khác thao tác trên tin sẽ nhận HTTP 403.
    """
    seller_id = (
        getattr(listing_or_seller_id, "seller_id", None)
        if hasattr(listing_or_seller_id, "seller_id")
        else listing_or_seller_id
    )
    if seller_id is None:
        raise ForbiddenException(message="Không xác định được chủ sở hữu tin đăng")

    if user.user_id != seller_id and user.role != "admin":
        raise ForbiddenException(
            message="Bạn không phải chủ tin đăng này và không có quyền thực hiện thao tác"
        )
