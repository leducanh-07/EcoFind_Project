"""
Unit and Integration Tests for Image Upload & ImageStorageAdapter (TE9C740, BR-04, NFR-MNT-01, NFR-SEC-04, TC-06, UC-05).
"""

import io
import os
import shutil
import tempfile
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.config import settings
from app.core.dependencies import get_current_user
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.user import User
from app.adapters.image_storage_adapter import (
    BaseImageStorageAdapter,
    LocalImageStorageAdapter,
    CloudinaryImageStorageAdapter,
    validate_image_file,
    ALLOWED_IMAGE_EXTENSIONS,
    ALLOWED_IMAGE_MIME_TYPES,
    MAX_IMAGE_SIZE_BYTES,
)

client = TestClient(app)

# Helper byte signatures for test images
VALID_JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00" + b"X" * 100
VALID_PNG_BYTES = b"\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01" + b"Y" * 100
GIF_BYTES = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\xff\xff\xff\x00\x00\x00!\xf9\x04"


@pytest.fixture
def mock_user():
    return User(
        user_id=1,
        full_name="Nguyễn Văn Minh Tín",
        email="tin.nguyen@ecofind.vn",
        phone="0912345678",
        password_hash="fakehash",
        role="user",
    )


@pytest.fixture
def auth_headers(mock_user):
    token = create_access_token({
        "sub": str(mock_user.user_id),
        "email": mock_user.email,
        "role": mock_user.role,
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def mock_db_session():
    """Mock get_db globally for test suite."""
    from unittest.mock import AsyncMock
    mock_db = AsyncMock()

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    yield mock_db
    app.dependency_overrides.clear()


@pytest.fixture
def temp_upload_dir():
    """Create a temporary directory for uploaded images and clean up after tests."""
    temp_dir = tempfile.mkdtemp()
    original_upload_dir = settings.UPLOAD_DIR
    settings.UPLOAD_DIR = temp_dir
    yield temp_dir
    settings.UPLOAD_DIR = original_upload_dir
    shutil.rmtree(temp_dir, ignore_errors=True)


# -----------------------------------------------------------------------------
# 1. AUTHENTICATION & ACCESS CONTROL
# -----------------------------------------------------------------------------

def test_upload_images_unauthenticated_returns_401():
    """UC-05: Người dùng chưa đăng nhập gọi POST /api/upload/images phải nhận HTTP 401."""
    files = [("files", ("test.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg"))]
    response = client.post("/api/upload/images", files=files)
    assert response.status_code == 401
    data = response.json()
    assert data["error"]["code"] == 401
    assert "Chưa đăng nhập" in data["error"]["message"] or "token" in data["error"]["message"].lower()


def test_upload_images_invalid_token_returns_401():
    """UC-05: Gửi token không hợp lệ trả về HTTP 401."""
    files = [("files", ("test.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg"))]
    response = client.post(
        "/api/upload/images",
        headers={"Authorization": "Bearer fake.garbage.token"},
        files=files,
    )
    assert response.status_code == 401
    assert response.json()["error"]["code"] == 401


# -----------------------------------------------------------------------------
# 2. SUCCESSFUL UPLOAD & RETRIEVAL (1 TO 5 FILES)
# -----------------------------------------------------------------------------

def test_upload_single_valid_jpeg(mock_user, auth_headers, temp_upload_dir):
    """BR-04, UC-05: Tải lên 1 ảnh JPG hợp lệ trả về 201 và đường dẫn ảnh ngẫu nhiên."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        files = [("files", ("my_photo.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg"))]
        response = client.post("/api/upload/images", headers=auth_headers, files=files)
        assert response.status_code == 201
        data = response.json()

        assert data["count"] == 1
        assert len(data["urls"]) == 1
        assert len(data["photos"]) == 1

        url = data["urls"][0]
        assert url.startswith("/uploads/")
        assert url.endswith(".jpg")
        # Đảm bảo tên tệp đã được sinh ngẫu nhiên, không giữ nguyên 'my_photo.jpg' (NFR-SEC-04)
        assert "my_photo" not in url

        # Kiểm tra tệp thực sự tồn tại trong thư mục lưu trữ
        filename = os.path.basename(url)
        assert os.path.exists(os.path.join(temp_upload_dir, filename))
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_upload_maximum_five_files_success(mock_user, auth_headers, temp_upload_dir):
    """BR-04: Tải lên tối đa 5 ảnh (kết hợp JPG và PNG) thành công."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        files = [
            ("files", ("photo1.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")),
            ("files", ("photo2.png", io.BytesIO(VALID_PNG_BYTES), "image/png")),
            ("files", ("photo3.jpeg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")),
            ("files", ("photo4.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg")),
            ("files", ("photo5.png", io.BytesIO(VALID_PNG_BYTES), "image/png")),
        ]
        response = client.post("/api/upload/images", headers=auth_headers, files=files)
        assert response.status_code == 201
        data = response.json()

        assert data["count"] == 5
        assert len(data["urls"]) == 5
        for idx, item in enumerate(data["photos"]):
            assert item["sortOrder"] == idx + 1
            assert item["url"].startswith("/uploads/")
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# -----------------------------------------------------------------------------
# 3. TC-06 & BR-04: VALIDATION FAILURES (COUNT, SIZE, FORMAT)
# -----------------------------------------------------------------------------

def test_tc06_reject_six_mb_file(mock_user, auth_headers):
    """TC-06, BR-04: Ảnh 6 MB (> 5 MB) bị từ chối với HTTP 400."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        six_mb_content = VALID_JPEG_BYTES + b"0" * (6 * 1024 * 1024)
        files = [("files", ("huge_photo.jpg", io.BytesIO(six_mb_content), "image/jpeg"))]
        response = client.post("/api/upload/images", headers=auth_headers, files=files)
        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == 400
        assert "5 MB" in data["error"]["message"] or "dung lượng" in data["error"]["message"].lower()
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_tc06_reject_gif_file(mock_user, auth_headers):
    """TC-06, BR-04: Tệp GIF bị từ chối với HTTP 400."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        files = [("files", ("animation.gif", io.BytesIO(GIF_BYTES), "image/gif"))]
        response = client.post("/api/upload/images", headers=auth_headers, files=files)
        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == 400
        assert "JPG hoặc PNG" in data["error"]["message"] or "GIF" in data["error"]["message"]
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_reject_spoofed_extension_gif_named_png(mock_user, auth_headers):
    """NFR-SEC-04: Tệp GIF đổi đuôi thành .png nhưng nội dung là GIF vẫn bị từ chối với HTTP 400."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        # Tệp có tên fake.png, mime image/png nhưng bytes bắt đầu bằng GIF89a
        files = [("files", ("fake.png", io.BytesIO(GIF_BYTES), "image/png"))]
        response = client.post("/api/upload/images", headers=auth_headers, files=files)
        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == 400
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_reject_more_than_five_files(mock_user, auth_headers):
    """BR-04: Gửi quá 5 ảnh (6 ảnh) trả về HTTP 400."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        files = [
            ("files", (f"photo{i}.jpg", io.BytesIO(VALID_JPEG_BYTES), "image/jpeg"))
            for i in range(1, 7)
        ]
        response = client.post("/api/upload/images", headers=auth_headers, files=files)
        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == 400
        assert "tối đa 5" in data["error"]["message"].lower() or "5" in str(data["error"]["fields"])
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_reject_empty_file_zero_bytes(mock_user, auth_headers):
    """BR-04, NFR-SEC-04: Tệp rỗng 0 bytes trả về HTTP 400."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        files = [("files", ("empty.jpg", io.BytesIO(b""), "image/jpeg"))]
        response = client.post("/api/upload/images", headers=auth_headers, files=files)
        assert response.status_code == 400
        data = response.json()
        assert data["error"]["code"] == 400
    finally:
        app.dependency_overrides.pop(get_current_user, None)


def test_reject_unsupported_extensions(mock_user, auth_headers):
    """BR-04: Từ chối các định dạng khác như .pdf, .txt, .webp, .exe với HTTP 400."""
    app.dependency_overrides[get_current_user] = lambda: mock_user
    try:
        unsupported = [
            ("document.pdf", b"%PDF-1.4...", "application/pdf"),
            ("image.webp", b"RIFF....WEBP", "image/webp"),
            ("script.exe", b"MZ..........", "application/x-msdownload"),
        ]
        for fname, content, mime in unsupported:
            files = [("files", (fname, io.BytesIO(content), mime))]
            res = client.post("/api/upload/images", headers=auth_headers, files=files)
            assert res.status_code == 400
            assert res.json()["error"]["code"] == 400
    finally:
        app.dependency_overrides.pop(get_current_user, None)


# -----------------------------------------------------------------------------
# 4. ADAPTER PATTERN & EXTENSIBILITY (NFR-MNT-01)
# -----------------------------------------------------------------------------

def test_nfr_mnt_01_cloudinary_adapter_swappable():
    """NFR-MNT-01: Kiểm tra tính cắm rút của ImageStorageAdapter (Cloudinary)."""
    import asyncio

    async def _run():
        adapter = CloudinaryImageStorageAdapter(cloud_name="my_test_cloud")
        url = await adapter.save(VALID_JPEG_BYTES, "sample.jpg", "image/jpeg")
        assert url.startswith("https://res.cloudinary.com/my_test_cloud/image/upload/")
        assert url.endswith(".jpg")

    asyncio.run(_run())


def test_nfr_mnt_01_custom_storage_adapter():
    """NFR-MNT-01: Tự định nghĩa một adapter lưu trữ bên ngoài theo BaseImageStorageAdapter."""
    import asyncio

    class S3MockStorageAdapter(BaseImageStorageAdapter):
        async def save(self, content: bytes, original_filename: str, content_type: str) -> str:
            return f"https://s3.amazonaws.com/ecofind-bucket/{original_filename}"

        async def delete(self, url: str) -> bool:
            return True

    async def _run():
        adapter = S3MockStorageAdapter()
        url = await adapter.save(VALID_PNG_BYTES, "test.png", "image/png")
        assert url == "https://s3.amazonaws.com/ecofind-bucket/test.png"

    asyncio.run(_run())
