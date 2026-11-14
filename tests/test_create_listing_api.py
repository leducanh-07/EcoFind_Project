"""
Tests for Create Listing Endpoint (POST /api/listings)
UC-05, FR-08, FR-09, BR-01, BR-04, BR-05, TC-05, TC-06, TE9C746.
"""

import io
import pytest
from unittest.mock import AsyncMock, patch
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.core.dependencies import get_current_user
from app.core.security import create_access_token
from app.models.category import Category
from app.models.listing import Listing
from app.models.user import User

client = TestClient(app)

VALID_JPEG_BYTES = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x01\x00`\x00`\x00\x00" + b"X" * 100


@pytest.fixture
def mock_seller():
    return User(
        user_id=1,
        full_name="Nguyễn Văn Minh Tín",
        email="tin.nguyen@ecofind.vn",
        phone="0912345678",
        password_hash="fakehash",
        role="user",
    )


@pytest.fixture
def auth_headers(mock_seller):
    token = create_access_token({
        "sub": str(mock_seller.user_id),
        "email": mock_seller.email,
        "role": mock_seller.role,
    })
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(autouse=True)
def setup_dependencies(mock_seller):
    """Override get_db và get_current_user cho toàn bộ test suite."""
    mock_db = AsyncMock()

    async def override_get_db():
        yield mock_db

    async def override_get_current_user():
        return mock_seller

    app.dependency_overrides[get_db] = override_get_db
    app.dependency_overrides[get_current_user] = override_get_current_user
    yield mock_db
    app.dependency_overrides.clear()


def create_dummy_image(name: str = "item.jpg", content_type: str = "image/jpeg") -> tuple:
    """Tạo file ảnh hợp lệ với JPEG magic bytes."""
    return ("photos", (name, io.BytesIO(VALID_JPEG_BYTES), content_type))


def test_post_listing_unauthenticated_returns_401():
    """Gửi tin đăng khi chưa đăng nhập trả về 401 Unauthorized."""
    # Xóa override get_current_user tạm thời để kiểm tra xác thực thực tế
    app.dependency_overrides.pop(get_current_user, None)
    response = client.post("/api/listings", data={"title": "Bàn học"})
    assert response.status_code == 401
    assert "token" in response.json()["error"]["message"].lower() or "đăng nhập" in response.json()["error"]["message"].lower()


def test_post_listing_missing_required_fields_returns_400(auth_headers):
    """Thiếu các trường bắt buộc trả về 400 kèm fields dictionary."""
    img = create_dummy_image()

    response = client.post(
        "/api/listings",
        headers=auth_headers,
        data={
            "title": "   ",  # Trống
            "price": 100000,
            "description": "",
            "address": "",
        },
        files=[img],
    )
    assert response.status_code == 400
    data = response.json()
    assert "error" in data
    assert "fields" in data["error"]
    fields = data["error"]["fields"]
    assert "title" in fields
    assert "description" in fields
    assert "address" in fields


@patch("app.services.listing_service.CategoryRepository.find_by_id")
def test_post_listing_invalid_price_and_scores_returns_400(mock_find_cat, auth_headers):
    """Giá bán âm hoặc quá 1 tỷ (BR-05) và điểm ngoài 0-10 (E3) trả về 400 với fields."""
    mock_cat = Category(category_id=1, name="Đồ gia dụng")
    mock_find_cat.return_value = mock_cat

    img = create_dummy_image()

    response = client.post(
        "/api/listings",
        headers=auth_headers,
        data={
            "title": "Bàn học thanh lý",
            "categoryId": 1,
            "price": 2000000000,  # 2 tỷ > 1 tỷ (BR-05)
            "description": "Bàn còn rất mới",
            "address": "123 Lê Lợi, Quận 1",
            "scoreAppearance": 12.0,  # > 10 (E3)
            "scoreFunction": -1.0,   # < 0 (E3)
            "scoreAccessories": 8.0,
        },
        files=[img],
    )
    assert response.status_code == 400
    fields = response.json()["error"]["fields"]
    assert "price" in fields
    assert "appearance" in fields
    assert "function" in fields


@patch("app.services.listing_service.CategoryRepository.find_by_id")
@patch("app.repositories.listing_repository.ListingRepository.create")
@patch("app.services.listing_service.process_and_save_upload_files")
def test_post_listing_success_returns_201_and_pending_status(
    mock_save_photos,
    mock_create_listing,
    mock_find_cat,
    auth_headers,
):
    """
    Đăng tin thành công (UC-05):
      - Trả 201 kèm status='pending'
      - Server tính lại điểm tổng và phân hạng theo BR-01, BR-02 (TC-05)
      - Trả message 'Đã gửi, chờ duyệt'
    """
    mock_cat = Category(category_id=1, name="Đồ gia dụng")
    mock_find_cat.return_value = mock_cat

    mock_save_photos.return_value = ["/uploads/photos/photo1.jpg"]

    # Giả lập tin được tạo trong DB với status = 'pending'
    mock_listing = Listing(
        listing_id=101,
        seller_id=1,
        category_id=1,
        title="Bàn làm việc gỗ sồi",
        description="Bàn còn chắc chắn, đẹp 90%",
        price=350000,
        address="456 Nguyễn Huệ, Quận 1",
        lat=10.7769,
        lng=106.7009,
        score_appearance=9.0,
        score_function=8.0,
        score_accessories=7.0,
        total_score=8.2,  # 0.4*9 + 0.4*8 + 0.2*7 = 3.6 + 3.2 + 1.4 = 8.2 (TC-05)
        status="pending",
    )
    mock_create_listing.return_value = mock_listing

    img = create_dummy_image()

    response = client.post(
        "/api/listings",
        headers=auth_headers,
        data={
            "title": "Bàn làm việc gỗ sồi",
            "categoryId": 1,
            "price": 350000,
            "description": "Bàn còn chắc chắn, đẹp 90%",
            "address": "456 Nguyễn Huệ, Quận 1",
            "lat": 10.7769,
            "lng": 106.7009,
            "scoreAppearance": 9.0,
            "scoreFunction": 8.0,
            "scoreAccessories": 7.0,
        },
        files=[img],
    )

    assert response.status_code == 201
    data = response.json()
    assert data["id"] == 101
    assert data["status"] == "pending"
    assert data["totalScore"] == 8.2
    assert data["rank"] == "Tốt"
    assert data["message"] == "Đã gửi, chờ duyệt"


@patch("app.repositories.listing_repository.ListingRepository.find_filtered")
def test_fr09_pending_listings_not_shown_on_map(mock_find_filtered):
    """
    Quy tắc FR-09: Tin đang ở trạng thái 'pending' không xuất hiện trên bản đồ (GET /api/listings).
    Chỉ có tin có status = 'selling' mới được hiển thị.
    """
    mock_find_filtered.return_value = []
    response = client.get("/api/listings?bbox=106.6,10.7,106.8,10.8")
    assert response.status_code == 200
    assert response.json() == []


@patch("app.services.listing_service.CategoryRepository.find_by_id")
@patch("app.repositories.listing_repository.ListingRepository.create")
@patch("app.services.listing_service.process_and_save_upload_files")
def test_post_listing_tc05_server_recalculates_score_ignoring_client_total(
    mock_save_photos,
    mock_create_listing,
    mock_find_cat,
    auth_headers,
):
    """
    Tiêu chuẩn TC-05 (TE9C741): Client gửi 3 điểm 9, 8, 7 kèm totalScore giả mạo 10.0,
    Server tính lại điểm tổng chính xác = 8.2 và xếp hạng 'Tốt', bỏ qua giá trị client.
    """
    mock_cat = Category(category_id=1, name="Đồ gia dụng")
    mock_find_cat.return_value = mock_cat
    mock_save_photos.return_value = ["/uploads/photos/photo1.jpg"]

    mock_listing = Listing(
        listing_id=102,
        seller_id=1,
        category_id=1,
        title="Tủ sách gỗ tự nhiên",
        description="Tủ sách 4 ngăn",
        price=500000,
        address="789 Điện Biên Phủ, Bình Thạnh",
        lat=10.8000,
        lng=106.7100,
        score_appearance=9.0,
        score_function=8.0,
        score_accessories=7.0,
        total_score=8.2,
        status="pending",
    )
    mock_create_listing.return_value = mock_listing

    img = create_dummy_image()

    response = client.post(
        "/api/listings",
        headers=auth_headers,
        data={
            "title": "Tủ sách gỗ tự nhiên",
            "categoryId": 1,
            "price": 500000,
            "description": "Tủ sách 4 ngăn",
            "address": "789 Điện Biên Phủ, Bình Thạnh",
            "lat": 10.8000,
            "lng": 106.7100,
            "scoreAppearance": 9.0,
            "scoreFunction": 8.0,
            "scoreAccessories": 7.0,
            "totalScore": 10.0,  # Giá trị giả mạo từ client
        },
        files=[img],
    )

    assert response.status_code == 201
    data = response.json()
    assert data["totalScore"] == 8.2  # Server tính lại
    assert data["rank"] == "Tốt"
    # Kiểm tra create được gọi với total_score = 8.2
    assert mock_create_listing.call_args[1]["total_score"] == 8.2


@patch("app.services.listing_service.CategoryRepository.find_by_id")
@patch("app.repositories.listing_repository.ListingRepository.create")
@patch("app.services.listing_service.process_and_save_upload_files")
def test_post_listing_price_boundaries_zero_and_one_billion(
    mock_save_photos,
    mock_create_listing,
    mock_find_cat,
    auth_headers,
):
    """
    Tiêu chuẩn BR-05 (TE9C741):
      - price = 0 (Cho tặng): hợp lệ (201)
      - price = 1_000_000_000 (1 tỷ): hợp lệ (201)
      - price = 1_000_000_001: lỗi 400
    """
    mock_cat = Category(category_id=1, name="Đồ gia dụng")
    mock_find_cat.return_value = mock_cat
    mock_save_photos.return_value = ["/uploads/photos/photo1.jpg"]

    # 1. Price = 0 (Cho tặng)
    mock_listing_free = Listing(
        listing_id=103,
        seller_id=1,
        category_id=1,
        title="Tặng giáo trình cũ",
        description="Cho bạn nào cần",
        price=0,
        address="Quận 1",
        lat=10.77,
        lng=106.70,
        score_appearance=8.0,
        score_function=8.0,
        score_accessories=8.0,
        total_score=8.0,
        status="pending",
    )
    mock_create_listing.return_value = mock_listing_free

    img = create_dummy_image()
    res_free = client.post(
        "/api/listings",
        headers=auth_headers,
        data={
            "title": "Tặng giáo trình cũ",
            "categoryId": 1,
            "price": 0,
            "description": "Cho bạn nào cần",
            "address": "Quận 1",
            "scoreAppearance": 8.0,
            "scoreFunction": 8.0,
            "scoreAccessories": 8.0,
        },
        files=[img],
    )
    assert res_free.status_code == 201

    # 2. Price = 1 tỷ
    img2 = create_dummy_image()
    res_billion = client.post(
        "/api/listings",
        headers=auth_headers,
        data={
            "title": "Đồng hồ cổ giá trị cao",
            "categoryId": 1,
            "price": 1000000000,
            "description": "Đồ sưu tầm",
            "address": "Quận 1",
            "scoreAppearance": 9.0,
            "scoreFunction": 9.0,
            "scoreAccessories": 9.0,
        },
        files=[img2],
    )
    assert res_billion.status_code == 201

    # 3. Price = 1 tỷ + 1 -> 400
    img3 = create_dummy_image()
    res_over = client.post(
        "/api/listings",
        headers=auth_headers,
        data={
            "title": "Món đồ siêu đắt",
            "categoryId": 1,
            "price": 1000000001,
            "description": "Giá quá 1 tỷ",
            "address": "Quận 1",
            "scoreAppearance": 9.0,
            "scoreFunction": 9.0,
            "scoreAccessories": 9.0,
        },
        files=[img3],
    )
    assert res_over.status_code == 400
    assert "price" in res_over.json()["error"]["fields"]


def test_post_listing_requires_photos(auth_headers):
    """Không gửi kèm ảnh trả về lỗi 400 (bắt buộc từ 1 đến 5 ảnh theo BR-04)."""
    response = client.post(
        "/api/listings",
        headers=auth_headers,
        data={
            "title": "Bàn học thanh lý",
            "categoryId": 1,
            "price": 200000,
            "description": "Bàn học",
            "address": "Quận 1",
            "scoreAppearance": 8.0,
            "scoreFunction": 8.0,
            "scoreAccessories": 8.0,
        },
        files=[],
    )
    assert response.status_code == 400
    assert "photos" in response.json()["error"]["fields"]

