"""Core configuration, database, security and error handling setup."""
from app.core.config import settings
from app.core.database import get_db
from app.core.exceptions import (
    AppException,
    BadRequestException,
    UnauthorizedException,
    ForbiddenException,
    NotFoundException,
    ConflictException,
    LockedException,
    InternalServerErrorException,
)
from app.core.error_handlers import register_exception_handlers
from app.core.security import (
    verify_password,
    get_password_hash,
    create_access_token,
    decode_access_token,
)
from app.core.dependencies import (
    get_current_user,
    get_optional_user,
    require_role,
    check_listing_owner,
)

__all__ = [
    "settings",
    "get_db",
    "AppException",
    "BadRequestException",
    "UnauthorizedException",
    "ForbiddenException",
    "NotFoundException",
    "ConflictException",
    "LockedException",
    "InternalServerErrorException",
    "register_exception_handlers",
    "verify_password",
    "get_password_hash",
    "create_access_token",
    "decode_access_token",
    "get_current_user",
    "get_optional_user",
    "require_role",
    "check_listing_owner",
]
