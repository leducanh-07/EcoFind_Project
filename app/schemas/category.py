"""
Pydantic Schemas for Categories (SDD 6.1, 7.2, UC-03).
"""

from typing import Optional
from app.schemas.health import BaseSchema


class CategoryResponse(BaseSchema):
    """Schema phản hồi danh mục sản phẩm đồ cũ."""
    id: int
    name: str
    category_id: Optional[int] = None

