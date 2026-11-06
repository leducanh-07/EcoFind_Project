"""Pydantic data validation schemas package."""
from app.schemas.health import BaseSchema, HealthResponse, DatabaseHealthResponse
from app.schemas.error import ErrorDetail, ErrorResponse

__all__ = [
    "BaseSchema",
    "HealthResponse",
    "DatabaseHealthResponse",
    "ErrorDetail",
    "ErrorResponse",
]
