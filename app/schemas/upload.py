"""
Pydantic Schemas for Image Uploads (BR-04, TC-06, UC-05, SDD 7.2).
"""

from typing import List
from app.schemas.health import BaseSchema


class UploadedPhotoItem(BaseSchema):
    """Thông tin ảnh đã tải lên thành công."""
    url: str
    sort_order: int


class UploadPhotosResponse(BaseSchema):
    """
    Phản hồi khi tải lên danh sách ảnh (POST /api/upload/images).
    Bao gồm danh sách đường dẫn URL, danh sách chi tiết kèm thứ tự và tổng số ảnh.
    """
    urls: List[str]
    photos: List[UploadedPhotoItem]
    count: int
