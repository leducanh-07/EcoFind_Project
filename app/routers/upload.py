"""
Upload Router for Images (BR-04, TC-06, UC-05, NFR-MNT-01, NFR-SEC-04).
Endpoint: POST /api/upload/images
Requires authenticated user (STT 11).
Receives 1 to 5 files via UploadFile (python-multipart).
Validates format (JPG/PNG only) and size (<= 5 MB).
"""

from typing import List
from fastapi import APIRouter, Depends, File, UploadFile, status

from app.core.dependencies import get_current_user
from app.models.user import User
from app.adapters.image_storage_adapter import process_and_save_upload_files
from app.schemas.upload import UploadPhotosResponse, UploadedPhotoItem

router = APIRouter(prefix="/upload", tags=["Upload"])


@router.post(
    "/images",
    response_model=UploadPhotosResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Tải lên 1 đến 5 ảnh chụp sản phẩm (JPG/PNG, tối đa 5 MB/ảnh)",
)
@router.post(
    "",
    response_model=UploadPhotosResponse,
    status_code=status.HTTP_201_CREATED,
    include_in_schema=False,
)
async def upload_listing_photos(
    files: List[UploadFile] = File(
        ...,
        description="Danh sách 1 đến 5 ảnh sản phẩm định dạng JPG hoặc PNG (mỗi tệp <= 5 MB)",
    ),
    current_user: User = Depends(get_current_user),
):
    """
    Tải lên ảnh món đồ cho tin đăng:
      - Yêu cầu đăng nhập (JWT token hợp lệ).
      - Nhận 1–5 tệp bằng UploadFile (python-multipart).
      - Chỉ chấp nhận định dạng JPG/PNG (kiểm tra đuôi tệp, Content-Type và magic bytes).
      - Mỗi tệp <= 5 MB; ảnh 6 MB hoặc tệp GIF trả về 400 (TC-06).
      - Lưu vào thư mục máy chủ (hoặc Cloudinary) với tên tệp ngẫu nhiên (UUID) để bảo mật.
      - Trả về danh sách URL đường dẫn ảnh đã lưu.
    """
    saved_urls = await process_and_save_upload_files(files)
    photos = [
        UploadedPhotoItem(url=u, sort_order=idx + 1)
        for idx, u in enumerate(saved_urls)
    ]
    return UploadPhotosResponse(
        urls=saved_urls,
        photos=photos,
        count=len(saved_urls),
    )
