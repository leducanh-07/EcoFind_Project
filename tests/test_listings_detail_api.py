"""
Unit and Integration Tests for Listing Detail API (UC-04, FR-07, TC-04, SDD 7.2).
"""

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.category import Category
from app.models.listing import Listing
from app.models.listing_photo import ListingPhoto
from app.models.user import User

client = TestClient(app)


@pytest.fixture
def mock_seller():
    return User(
        user_id=1,
        full_name="Nguyễn Văn Bán Đồ",
        email="seller@ecofind.vn",
        phone="0987654321",
        password_hash="hash",
        role="user",
    )


@pytest.fixture
def mock_category():
    return Category(
        category_id=10,
        name="Bàn ghế gỗ",
    )


@pytest.fixture
def mock_listing(mock_seller, mock_category):
    now = datetime.now(timezone.utc)
    listing = Listing(
        listing_id=100,
        seller_id=mock_seller.user_id,
        category_id=mock_category.category_id,
        title="Bàn làm việc gỗ sồi tự nhiên",
        description="Bàn còn rất mới, chân chắc chắn, mặt bàn không trầy xước.",
        price=Decimal("450000"),
        address="123 Nguyễn Thị Minh Khai, Quận 3, TP.HCM",
        lat=10.7769,
        lng=106.6953,
        score_appearance=Decimal("8.5"),
        score_function=Decimal("9.0"),
        score_accessories=Decimal("7.0"),
        total_score=Decimal("8.4"),
        status="selling",
        created_at=now,
    )
    listing.seller = mock_seller
    listing.category = mock_category
    listing.photos = [
        ListingPhoto(photo_id=1, listing_id=100, url="https://example.com/p1.jpg", sort_order=1),
        ListingPhoto(photo_id=2, listing_id=100, url="https://example.com/p2.jpg", sort_order=2),
    ]
    return listing


def test_get_listing_detail_as_guest_masks_phone(mock_listing):
    """TC-04: Khách chưa đăng nhập xem chi tiết -> SĐT phải bị ẩn (phone is None)."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_listing
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.get("/api/listings/100")
        assert response.status_code == 200
        data = response.json()

        assert data["id"] == 100
        assert data["title"] == "Bàn làm việc gỗ sồi tự nhiên"
        assert data["price"] == 450000.0
        assert data["sellerName"] == "Nguyễn Văn Bán Đồ"
        assert data["phone"] is None  # Bị ẩn theo TC-04
        assert len(data["photos"]) == 2
        assert data["totalScore"] == 8.4
        assert data["rank"] == "Tốt"
    finally:
        app.dependency_overrides.clear()


def test_get_listing_detail_authenticated_reveals_phone(mock_listing, mock_seller):
    """TC-04: Người dùng đã đăng nhập (gửi kèm JWT hợp lệ) -> hiển thị đầy đủ SĐT."""
    token = create_access_token({
        "sub": "2",
        "email": "buyer@ecofind.vn",
        "role": "user",
    })

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_listing
    mock_db.execute.return_value = mock_result

    # Mock user query for get_current_user/get_optional_user
    mock_user = User(user_id=2, email="buyer@ecofind.vn", full_name="Người Mua", role="user")
    
    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        # Patch userRepository.find_by_id in dependencies
        from app.core import dependencies
        orig_find = dependencies.user_repo.find_by_id
        dependencies.user_repo.find_by_id = AsyncMock(return_value=mock_user)

        try:
            response = client.get(
                "/api/listings/100",
                headers={"Authorization": f"Bearer {token}"},
            )
            assert response.status_code == 200
            data = response.json()
            assert data["phone"] == "0987654321"  # SĐT được hiển thị!
        finally:
            dependencies.user_repo.find_by_id = orig_find
    finally:
        app.dependency_overrides.clear()


def test_get_listing_detail_not_found():
    """UC-04 E1: Tin không tồn tại trả về 404 'Tin không còn hiển thị'."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.get("/api/listings/99999")
        assert response.status_code == 404
        data = response.json()
        assert data["error"]["code"] == 404
        assert "Tin không còn hiển thị" in data["error"]["message"]
    finally:
        app.dependency_overrides.clear()


def test_get_listing_detail_sold_or_hidden(mock_listing):
    """Tin đã bán (sold) hoặc bị ẩn (hidden) người thường xem trả 404."""
    mock_listing.status = "sold"

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_listing
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.get("/api/listings/100")
        assert response.status_code == 404
        assert "Tin không còn hiển thị" in response.json()["error"]["message"]
    finally:
        app.dependency_overrides.clear()
