"""Core configuration, database and error handling setup."""
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
]
