"""
Image Storage Adapter (BR-04, NFR-MNT-01, NFR-SEC-04, TC-06, UC-05).
Handles saving images with random filenames, validates format (JPG/PNG only)
and file size (<= 5 MB), rejecting GIFs and oversized files with HTTP 400.
Conforms to NFR-MNT-01: pluggable storage (Local Server Directory or Cloudinary).
"""

from abc import ABC, abstractmethod
import os
import uuid
import logging
from typing import List, Optional
from fastapi import UploadFile

from app.core.config import settings
from app.core.exceptions import BadRequestException

logger = logging.getLogger("app.adapters.image_storage")

ALLOWED_IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png"}
ALLOWED_IMAGE_MIME_TYPES = {"image/jpeg", "image/png", "image/jpg"}
MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024  # 5 MB (5,242,880 bytes)
MIN_IMAGE_COUNT = 1
MAX_IMAGE_COUNT = 5


def validate_image_file(
    filename: Optional[str],
    content_type: Optional[str],
    content: bytes,
) -> None:
    """
    Kiểm tra tính hợp lệ của tệp ảnh theo BR-04, TC-06 và NFR-SEC-04:
      - Chỉ cho phép JPG hoặc PNG (đuôi tệp và mime type).
      - Tệp GIF hoặc định dạng khác bị từ chối với HTTP 400.
      - Dung lượng mỗi tệp không quá 5 MB (ảnh 6 MB trả về 400).
      - Tệp rỗng (0 bytes) bị từ chối.
      - Kiểm tra magic bytes ở đầu tệp để chống giả mạo đuôi tệp.
    """
    safe_name = filename or "unnamed_photo"

    # 1. Kiểm tra dung lượng
    if len(content) == 0:
        raise BadRequestException(
            message="Tệp ảnh rỗng (0 bytes)",
            fields={"photos": f"Tệp '{safe_name}' không có dữ liệu"},
        )

    if len(content) > MAX_IMAGE_SIZE_BYTES:
        size_mb = len(content) / (1024 * 1024)
        raise BadRequestException(
            message="Dung lượng mỗi ảnh không được vượt quá 5 MB",
            fields={"photos": f"Tệp '{safe_name}' vượt quá dung lượng cho phép ({size_mb:.1f} MB > 5 MB)"},
        )

    # 2. Kiểm tra đuôi tệp (extension)
    _, ext = os.path.splitext(safe_name)
    ext = ext.lower()
    if ext not in ALLOWED_IMAGE_EXTENSIONS:
        if ext == ".gif":
            raise BadRequestException(
                message="Chỉ chấp nhận ảnh định dạng JPG hoặc PNG (tệp GIF không được hỗ trợ)",
                fields={"photos": f"Tệp '{safe_name}' là định dạng GIF, hệ thống chỉ nhận JPG/PNG"},
            )
        raise BadRequestException(
            message="Chỉ chấp nhận ảnh định dạng JPG hoặc PNG",
            fields={"photos": f"Đuôi tệp '{ext}' của '{safe_name}' không hợp lệ (chỉ nhận .jpg, .jpeg, .png)"},
        )

    # 3. Kiểm tra MIME Type (Content-Type header)
    norm_mime = (content_type or "").lower().strip()
    if norm_mime not in ALLOWED_IMAGE_MIME_TYPES:
        if "gif" in norm_mime:
            raise BadRequestException(
                message="Chỉ chấp nhận ảnh định dạng JPG hoặc PNG (tệp GIF không được hỗ trợ)",
                fields={"photos": f"MIME type '{content_type}' không được hỗ trợ (tệp GIF bị từ chối)"},
            )
        raise BadRequestException(
            message="Chỉ chấp nhận ảnh định dạng JPG hoặc PNG",
            fields={"photos": f"MIME type '{content_type}' không hợp lệ (chỉ nhận image/jpeg, image/png)"},
        )

    # 4. Kiểm tra Magic Bytes chống giả mạo nội dung (NFR-SEC-04)
    if content.startswith(b"GIF87a") or content.startswith(b"GIF89a"):
        raise BadRequestException(
            message="Chỉ chấp nhận ảnh định dạng JPG hoặc PNG (tệp GIF không được hỗ trợ)",
            fields={"photos": f"Tệp '{safe_name}' có nội dung là ảnh GIF"},
        )

    if ext in [".jpg", ".jpeg"] and not content.startswith(b"\xff\xd8"):
        raise BadRequestException(
            message="Nội dung tệp không phải định dạng JPEG hợp lệ",
            fields={"photos": f"Tệp '{safe_name}' có tiêu đề nhị phân không khớp chuẩn JPEG"},
        )

    if ext == ".png" and not content.startswith(b"\x89PNG\r\n\x1a\n"):
        raise BadRequestException(
            message="Nội dung tệp không phải định dạng PNG hợp lệ",
            fields={"photos": f"Tệp '{safe_name}' có tiêu đề nhị phân không khớp chuẩn PNG"},
        )


class BaseImageStorageAdapter(ABC):
    """Lớp giao diện trừu tượng cho tầng lưu trữ ảnh (NFR-MNT-01)."""

    @abstractmethod
    async def save(self, content: bytes, original_filename: str, content_type: str) -> str:
        """
        Lưu nội dung ảnh nhị phân và trả về đường dẫn URL truy cập.
        Tên tệp phải được sinh ngẫu nhiên để chống trùng lặp và tấn công đường dẫn.
        """
        pass

    @abstractmethod
    async def delete(self, url: str) -> bool:
        """Xóa tệp ảnh nếu có yêu cầu hủy tin hoặc cập nhật ảnh."""
        pass


class LocalImageStorageAdapter(BaseImageStorageAdapter):
    """
    Adapter lưu trữ ảnh trên thư mục máy chủ cục bộ (Server Directory).
    Sinh tên tệp ngẫu nhiên bằng UUIDv4 để tránh trùng lặp và bảo mật (NFR-SEC-04).
    """

    def __init__(
        self,
        upload_dir: Optional[str] = None,
        base_url_prefix: str = "/uploads",
    ):
        self._upload_dir = upload_dir
        self.base_url_prefix = base_url_prefix.rstrip("/")

    @property
    def upload_dir(self) -> str:
        target_dir = self._upload_dir or getattr(settings, "UPLOAD_DIR", "uploads")
        os.makedirs(target_dir, exist_ok=True)
        return target_dir

    async def save(self, content: bytes, original_filename: str, content_type: str) -> str:
        """Lưu ảnh vào thư mục server với tên ngẫu nhiên và trả về đường dẫn /uploads/..."""
        _, ext = os.path.splitext(original_filename or "")
        ext = ext.lower()
        if not ext or ext not in ALLOWED_IMAGE_EXTENSIONS:
            ext = ".png" if "png" in (content_type or "").lower() else ".jpg"

        # Tên tệp ngẫu nhiên bằng UUID (NFR-SEC-04)
        random_filename = f"{uuid.uuid4().hex}{ext}"
        target_path = os.path.join(self.upload_dir, random_filename)

        with open(target_path, "wb") as f:
            f.write(content)

        logger.info("Saved image to local path: %s", target_path)
        return f"{self.base_url_prefix}/{random_filename}"

    async def delete(self, url: str) -> bool:
        """Xóa tệp ảnh cục bộ nếu tồn tại."""
        try:
            filename = os.path.basename(url)
            file_path = os.path.join(self.upload_dir, filename)
            if os.path.exists(file_path):
                os.remove(file_path)
                return True
        except Exception as e:
            logger.warning("Failed to delete local image '%s': %s", url, e)
        return False


class CloudinaryImageStorageAdapter(BaseImageStorageAdapter):
    """
    Adapter dự phòng tích hợp Cloudinary (Cloud Storage) theo NFR-MNT-01.
    Cho phép chuyển đổi nhà cung cấp mà không cần thay đổi tầng Router/Service.
    """

    def __init__(self, cloud_name: Optional[str] = None):
        self.cloud_name = cloud_name

    async def save(self, content: bytes, original_filename: str, content_type: str) -> str:
        # Giả lập hoặc gọi Cloudinary API khi cấu hình cloud credentials
        random_filename = f"{uuid.uuid4().hex}"
        return f"https://res.cloudinary.com/{self.cloud_name or 'ecofind'}/image/upload/{random_filename}.jpg"

    async def delete(self, url: str) -> bool:
        return True


# Default instance
ImageStorageAdapter = LocalImageStorageAdapter
default_image_storage_adapter = LocalImageStorageAdapter()


async def process_and_save_upload_files(
    files: List[UploadFile],
    adapter: Optional[BaseImageStorageAdapter] = None,
) -> List[str]:
    """
    Hàm tiện ích dùng chung cho Router tải ảnh độc lập và API đăng tin:
      - Kiểm tra số lượng ảnh: 1 đến 5 ảnh (BR-04).
      - Đọc nội dung và kiểm tra định dạng/dung lượng (TC-06).
      - Lưu ảnh qua ImageStorageAdapter với tên ngẫu nhiên.
      - Trả về danh sách URL đường dẫn ảnh đã lưu.
    """
    if not files or len(files) == 0:
        raise BadRequestException(
            message="Vui lòng tải lên từ 1 đến 5 ảnh",
            fields={"photos": "Yêu cầu tải lên ít nhất 1 ảnh (BR-04)"},
        )

    if len(files) > MAX_IMAGE_COUNT:
        raise BadRequestException(
            message=f"Mỗi tin chỉ được tải tối đa {MAX_IMAGE_COUNT} ảnh",
            fields={"photos": f"Số lượng ảnh gửi lên ({len(files)}) vượt quá giới hạn tối đa {MAX_IMAGE_COUNT} ảnh (BR-04)"},
        )

    storage = adapter or default_image_storage_adapter

    # 1. Đọc và kiểm tra toàn bộ tệp trước khi lưu (all or nothing)
    file_contents = []
    for f in files:
        content = await f.read()
        validate_image_file(f.filename, f.content_type, content)
        file_contents.append((content, f.filename, f.content_type))

    # 2. Lưu từng tệp qua adapter
    saved_urls: List[str] = []
    for content, orig_name, mime in file_contents:
        url = await storage.save(content, orig_name, mime)
        saved_urls.append(url)

    return saved_urls
