"""
Custom Application Exceptions conforming to SDD 7.1.
Maps status codes: 400, 401, 403, 404, 409, 423, 500.
"""

from typing import Any, Dict, Optional, Union
from fastapi import status


class AppException(Exception):
    """Lớp ngoại lệ cơ sở cho toàn bộ ứng dụng."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_400_BAD_REQUEST,
        code: Optional[Union[int, str]] = None,
        fields: Optional[Dict[str, Any]] = None,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.code = code if code is not None else status_code
        self.fields = fields


class BadRequestException(AppException):
    """HTTP 400: Dữ liệu gửi lên không hợp lệ."""

    def __init__(
        self,
        message: str = "Dữ liệu yêu cầu không hợp lệ",
        fields: Optional[Dict[str, Any]] = None,
        code: Optional[Union[int, str]] = None,
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            code=code or status.HTTP_400_BAD_REQUEST,
            fields=fields,
        )


class UnauthorizedException(AppException):
    """HTTP 401: Chưa đăng nhập hoặc JWT token không hợp lệ."""

    def __init__(
        self,
        message: str = "Chưa đăng nhập hoặc phiên làm việc đã hết hạn",
        code: Optional[Union[int, str]] = None,
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            code=code or status.HTTP_401_UNAUTHORIZED,
        )


class ForbiddenException(AppException):
    """HTTP 403: Không có quyền truy cập chức năng này."""

    def __init__(
        self,
        message: str = "Bạn không có quyền thực hiện hành động này",
        code: Optional[Union[int, str]] = None,
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            code=code or status.HTTP_403_FORBIDDEN,
        )


class NotFoundException(AppException):
    """HTTP 404: Không tìm thấy tài nguyên."""

    def __init__(
        self,
        message: str = "Không tìm thấy tài nguyên yêu cầu",
        code: Optional[Union[int, str]] = None,
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            code=code or status.HTTP_404_NOT_FOUND,
        )


class ConflictException(AppException):
    """HTTP 409: Xung đột dữ liệu (email trùng, trạng thái không hợp lệ)."""

    def __init__(
        self,
        message: str = "Dữ liệu bị xung đột hoặc trạng thái không hợp lệ",
        code: Optional[Union[int, str]] = None,
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            code=code or status.HTTP_409_CONFLICT,
        )


class LockedException(AppException):
    """HTTP 423: Tài khoản bị tạm khóa 15 phút (sau 5 lần nhập sai)."""

    def __init__(
        self,
        message: str = "Tài khoản tạm thời bị khóa 15 phút do đăng nhập sai quá số lần quy định",
        code: Optional[Union[int, str]] = None,
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_423_LOCKED,
            code=code or status.HTTP_423_LOCKED,
        )


class InternalServerErrorException(AppException):
    """HTTP 500: Lỗi không lường trước phía máy chủ."""

    def __init__(
        self,
        message: str = "Lỗi hệ thống máy chủ, vui lòng thử lại sau",
        code: Optional[Union[int, str]] = None,
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            code=code or status.HTTP_500_INTERNAL_SERVER_ERROR,
        )
