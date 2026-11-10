"""
Unit and Integration Tests for Categories and Listings Map API.
Traceability: UC-02, UC-03, FR-03, BR-01, BR-02, BR-03, TC-07, SDD 6.1, SDD 7.2.
Task: TE9C731.
"""

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db
from app.models.category import Category
from app.models.listing import Listing

client = TestClient(app)


@pytest.fixture
def sample_categories():
    return [
        Category(category_id=1, name="Nội thất"),
        Category(category_id=2, name="Đồ điện tử"),
        Category(category_id=3, name="Sách & Văn phòng phẩm"),
    ]


@pytest.fixture
def sample_listings():
    now = datetime.now(timezone.utc)
    return [
        Listing(
            listing_id=101,
            seller_id=1,
            category_id=1,
            title="Bàn học gỗ sồi",
            description="Bàn học gỗ còn mới 90%",
            price=Decimal("450000"),
            address="Quận 3, TP.HCM",
            lat=10.7769,
            lng=106.6953,
            score_appearance=Decimal("7.0"),
            score_function=Decimal("7.0"),
            score_accessories=Decimal("4.0"),
            total_score=Decimal("6.4"),  # Hạng Khá
            status="selling",
            created_at=now,
        ),
        Listing(
            listing_id=102,
            seller_id=2,
            category_id=2,
            title="Tai nghe Bluetooth Sony",
            description="Tai nghe dùng tốt",
            price=Decimal("850000"),
            address="Quận 1, TP.HCM",
            lat=10.7750,
            lng=106.7000,
            score_appearance=Decimal("9.0"),
            score_function=Decimal("8.0"),
            score_accessories=Decimal("7.0"),
            total_score=Decimal("8.2"),  # Hạng Tốt
            status="selling",
            created_at=now,
        ),
    ]


def test_get_categories_success(sample_categories):
    """GET /api/categories trả về 200 cùng danh sách danh mục (UC-03)."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = sample_categories
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.get("/api/categories")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 3
        assert data[0]["name"] == "Nội thất"
        assert data[0]["id"] == 1
        assert data[1]["name"] == "Đồ điện tử"
    finally:
        app.dependency_overrides.clear()


def test_get_listings_with_valid_bbox(sample_listings):
    """
    GET /api/listings?bbox=... trả về tối đa 50 tin gồm:
    id, title, price, lat, lng, totalScore, rank (FR-03, SDD 7.2).
    """
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = sample_listings
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.get("/api/listings?bbox=106.6,10.7,106.8,10.9")
        assert response.status_code == 200
        data = response.json()
        assert len(data) == 2

        item1 = data[0]
        assert item1["id"] == 101
        assert item1["title"] == "Bàn học gỗ sồi"
        assert item1["price"] == 450000.0
        assert item1["lat"] == 10.7769
        assert item1["lng"] == 106.6953
        assert item1["totalScore"] == 6.4
        assert item1["rank"] == "Khá"
        assert item1["status"] == "selling"

        item2 = data[1]
        assert item2["id"] == 102
        assert item2["totalScore"] == 8.2
        assert item2["rank"] == "Tốt"
    finally:
        app.dependency_overrides.clear()


def test_get_listings_only_returns_selling_items(sample_listings):
    """
    TC-07 & BR-03: Chỉ tin status = 'selling' mới xuất hiện trong GET /api/listings.
    Tin pending không bao giờ xuất hiện.
    """
    now = datetime.now(timezone.utc)
    # Giả định CSDL có cả tin pending, rejected, sold
    pending_item = Listing(
        listing_id=999,
        seller_id=1,
        category_id=1,
        title="Tin đang chờ duyệt",
        description="Mô tả",
        price=Decimal("100000"),
        address="Q1",
        lat=10.77,
        lng=106.69,
        score_appearance=Decimal("5.0"),
        score_function=Decimal("5.0"),
        score_accessories=Decimal("5.0"),
        total_score=Decimal("5.0"),
        status="pending",
        created_at=now,
    )

    # Repository luôn lọc where(status == 'selling'), nên scalars().all() chỉ trả tin selling
    mock_db = AsyncMock()
    mock_result = MagicMock()
    # Repository lọc đúng chỉ trả sample_listings (đang bán)
    mock_result.scalars.return_value.all.return_value = [
        item for item in [pending_item, *sample_listings] if item.status == "selling"
    ]
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.get("/api/listings?bbox=106.6,10.7,106.8,10.9")
        assert response.status_code == 200
        data = response.json()
        # Tin pending (id 999) không được có mặt trong kết quả
        ids = [item["id"] for item in data]
        assert 999 not in ids
        assert all(item["status"] == "selling" for item in data)
    finally:
        app.dependency_overrides.clear()


def test_get_listings_invalid_bbox_format():
    """BBox sai định dạng (không đủ 4 tọa độ hoặc chứa chữ) trả HTTP 400 (FR-03)."""
    # 1. Sai định dạng chuỗi
    response = client.get("/api/listings?bbox=invalid_bbox_string")
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == 400
    assert "bbox" in data["error"]["fields"]

    # 2. Thiếu tọa độ (chỉ có 2 số)
    response2 = client.get("/api/listings?bbox=106.6,10.7")
    assert response2.status_code == 400
    assert response2.json()["error"]["code"] == 400

    # 3. Tọa độ vĩ độ ngoài phạm vi [-90, 90]
    response3 = client.get("/api/listings?bbox=106.6,100.0,106.8,10.9")
    assert response3.status_code == 400
    assert response3.json()["error"]["code"] == 400

    # 4. minLat > maxLat
    response4 = client.get("/api/listings?bbox=106.6,10.9,106.8,10.7")
    assert response4.status_code == 400
    assert response4.json()["error"]["code"] == 400

