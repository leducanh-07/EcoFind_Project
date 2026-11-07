"""Pydantic data validation schemas package."""
from app.schemas.health import BaseSchema, HealthResponse
from app.schemas.error import ErrorDetail, ErrorResponse
from app.schemas.auth import LoginRequest, TokenResponse, UserBasicInfo

__all__ = [
    "BaseSchema",
    "HealthResponse",
    "ErrorDetail",
    "ErrorResponse",
    "LoginRequest",
    "TokenResponse",
    "UserBasicInfo",
]
