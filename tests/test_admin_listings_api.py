"""
Unit and Integration Tests for Admin Listings & Moderation API.
Task TE9C747 (API Admin: hàng đợi & chi tiết tin chờ duyệt).
"""

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db
from app.core.dependencies import get_current_user, user_repo
from app.core.security import create_access_token
from app.models.category import Category
from app.models.listing import Listing
from app.models.listing_photo import ListingPhoto
from app.models.user import User

client = TestClient(app)


@pytest.fixture
def mock_admin():
    return User(
        user_id=99,
        full_name="Quản Trị Viên",
        email="admin@ecofind.vn",
        phone="0999999999",
        password_hash="hash",
        role="admin",
    )


@pytest.fixture
def mock_standard_user():
    return User(
        user_id=10,
        full_name="Người Dùng Thường",
        email="user@ecofind.vn",
        phone="0912345678",
        password_hash="hash",
        role="user",
    )


@pytest.fixture
def mock_seller():
    return User(
        user_id=20,
        full_name="Nguyễn Văn Bán",
        email="seller@ecofind.vn",
        phone="0988776655",
        password_hash="hash",
        role="user",
    )


@pytest.fixture
def mock_category():
    return Category(
        category_id=5,
        name="Đồ điện tử",
    )


@pytest.fixture
def mock_pending_listing(mock_seller, mock_category):
    now = datetime.now(timezone.utc)
    listing = Listing(
        listing_id=101,
        seller_id=mock_seller.user_id,
        category_id=mock_category.category_id,
        title="Laptop Dell XPS 13 cũ",
        description="Máy hoạt động bình thường, pin còn 4 tiếng.",
        price=Decimal("12000000"),
        address="123 Lê Lợi, Phường Bến Nghé, Quận 1, TP.HCM",
        lat=10.7725,
        lng=106.6980,
        score_appearance=Decimal("8.0"),
        score_function=Decimal("9.0"),
        score_accessories=Decimal("8.0"),
        total_score=Decimal("8.4"),
        status="pending",
        created_at=now,
    )
    listing.seller = mock_seller
    listing.category = mock_category
    listing.photos = [
        ListingPhoto(photo_id=1, listing_id=101, url="/uploads/laptop1.jpg", sort_order=0),
        ListingPhoto(photo_id=2, listing_id=101, url="/uploads/laptop2.jpg", sort_order=1),
    ]
    return listing


@pytest.fixture(autouse=True)
def override_db_dependency():
    mock_db = AsyncMock()

    async def _get_db():
        yield mock_db

    app.dependency_overrides[get_db] = _get_db
    yield mock_db
    app.dependency_overrides.pop(get_db, None)


def test_get_admin_listings_unauthorized():
    """Chưa đăng nhập truy cập hàng đợi admin nhận HTTP 401."""
    res = client.get("/api/admin/listings")
    assert res.status_code == 401


def test_get_admin_listings_forbidden_for_standard_user(mock_standard_user):
    """Người dùng thông thường (role = 'user') truy cập admin nhận HTTP 403 (TC-10)."""
    token = create_access_token({"sub": str(mock_standard_user.user_id)})

    # Mock user_repo find_by_id để trả về standard user
    orig_find = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_standard_user)

    try:
        res = client.get(
            "/api/admin/listings",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 403
    finally:
        user_repo.find_by_id = orig_find


def test_get_admin_listings_queue_success(mock_admin, mock_pending_listing):
    """Admin lấy danh sách hàng đợi tin chờ duyệt thành công (HTTP 200)."""
    token = create_access_token({"sub": str(mock_admin.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_admin)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = [mock_pending_listing]
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.get(
            "/api/admin/listings?status=pending&sort=asc",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) == 1
        item = data[0]
        assert item["id"] == 101
        assert item["title"] == "Laptop Dell XPS 13 cũ"
        assert item["status"] == "pending"
        assert item.get("sellerName") == "Nguyễn Văn Bán" or item.get("seller_name") == "Nguyễn Văn Bán"
        total = item.get("totalScore") if "totalScore" in item else item.get("total_score")
        assert total == 8.4
        assert item["rank"] == "Tốt"
        thumb = item.get("thumbnailUrl") or item.get("thumbnail_url")
        assert thumb == "/uploads/laptop1.jpg"
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_get_admin_listing_detail_success(mock_admin, mock_pending_listing):
    """Admin xem chi tiết tin chờ duyệt kèm người bán, ảnh, 3 điểm thành phần (HTTP 200)."""
    token = create_access_token({"sub": str(mock_admin.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_admin)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_pending_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.get(
            "/api/admin/listings/101",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == 101
        assert data["title"] == "Laptop Dell XPS 13 cũ"
        assert data["description"] == "Máy hoạt động bình thường, pin còn 4 tiếng."
        seller = data["seller"]
        user_id = seller.get("userId") if "userId" in seller else seller.get("user_id")
        assert user_id == 20
        full_name = seller.get("fullName") if "fullName" in seller else seller.get("full_name")
        assert full_name == "Nguyễn Văn Bán"
        assert seller["email"] == "seller@ecofind.vn"
        assert seller["phone"] == "0988776655"
        score_app = data.get("scoreAppearance") if "scoreAppearance" in data else data.get("score_appearance")
        assert score_app == 8.0
        score_func = data.get("scoreFunction") if "scoreFunction" in data else data.get("score_function")
        assert score_func == 9.0
        score_acc = data.get("scoreAccessories") if "scoreAccessories" in data else data.get("score_accessories")
        assert score_acc == 8.0
        total = data.get("totalScore") if "totalScore" in data else data.get("total_score")
        assert total == 8.4
        assert data["rank"] == "Tốt"
        assert len(data["photos"]) == 2
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_get_admin_listing_detail_not_found(mock_admin):
    """Xem tin không tồn tại trả về HTTP 404."""
    token = create_access_token({"sub": str(mock_admin.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_admin)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.get(
            "/api/admin/listings/99999",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 404
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_approve_listing_without_adjustments(mock_admin, mock_pending_listing):
    """Duyệt tin giữ nguyên điểm -> status chuyển thành 'selling'."""
    token = create_access_token({"sub": str(mock_admin.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_admin)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_pending_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.post(
            "/api/admin/listings/101/approve",
            headers={"Authorization": f"Bearer {token}"},
            json={},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == 101
        assert data["status"] == "selling"
        total = data.get("totalScore") if "totalScore" in data else data.get("total_score")
        assert total == 8.4
        assert data["rank"] == "Tốt"
        assert mock_pending_listing.status == "selling"
        assert mock_pending_listing.reviewed_by == mock_admin.user_id
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_approve_listing_with_score_reduction(mock_admin, mock_pending_listing):
    """Duyệt tin kèm hạ điểm -> tính lại total_score và rank theo ScoreCalculator."""
    token = create_access_token({"sub": str(mock_admin.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_admin)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_pending_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        # Ban đầu: app=8.0, func=9.0, acc=8.0 -> Hạ app xuống 5.0, func xuống 6.0, acc xuống 4.0
        # 0.4*5.0 + 0.4*6.0 + 0.2*4.0 = 2.0 + 2.4 + 0.8 = 5.2 -> Khá
        res = client.post(
            "/api/admin/listings/101/approve",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "adjustments": {
                    "score_appearance": 5.0,
                    "score_function": 6.0,
                    "score_accessories": 4.0,
                },
                "note": "Mặt lưng bị cấn móp, hạ điểm ngoại quan",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "selling"
        total = data.get("totalScore") if "totalScore" in data else data.get("total_score")
        assert total == 5.2
        assert data["rank"] == "Khá"
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_approve_listing_reject_higher_score(mock_admin, mock_pending_listing):
    """Chỉ cho phép hạ điểm; nếu tăng điểm thì trả về HTTP 400."""
    token = create_access_token({"sub": str(mock_admin.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_admin)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_pending_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        # app ban đầu là 8.0, cố tình tăng lên 9.5
        res = client.post(
            "/api/admin/listings/101/approve",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "adjustments": {
                    "score_appearance": 9.5,
                },
            },
        )
        assert res.status_code == 400
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_reject_listing_requires_reason(mock_admin, mock_pending_listing):
    """Từ chối tin bắt buộc có lý do (TC-11). Thiếu lý do trả về HTTP 400."""
    token = create_access_token({"sub": str(mock_admin.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_admin)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_pending_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.post(
            "/api/admin/listings/101/reject",
            headers={"Authorization": f"Bearer {token}"},
            json={"reason": ""},
        )
        assert res.status_code in (400, 422)
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_reject_listing_success(mock_admin, mock_pending_listing):
    """Từ chối tin hợp lệ -> status thành 'rejected', lưu reject_reason."""
    token = create_access_token({"sub": str(mock_admin.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_admin)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_pending_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.post(
            "/api/admin/listings/101/reject",
            headers={"Authorization": f"Bearer {token}"},
            json={"reason": "Hình ảnh mờ, vi phạm quy định đăng tin"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "rejected"
        assert mock_pending_listing.status == "rejected"
        assert mock_pending_listing.reject_reason == "Hình ảnh mờ, vi phạm quy định đăng tin"
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_approve_or_reject_already_processed_returns_409(mock_admin, mock_pending_listing):
    """Tin đã duyệt hoặc từ chối trước đó trả về HTTP 409 Conflict (E2)."""
    token = create_access_token({"sub": str(mock_admin.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_admin)

    # Đổi trạng thái tin thành selling (đã duyệt)
    mock_pending_listing.status = "selling"

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_pending_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res_approve = client.post(
            "/api/admin/listings/101/approve",
            headers={"Authorization": f"Bearer {token}"},
            json={},
        )
        assert res_approve.status_code == 409

        res_reject = client.post(
            "/api/admin/listings/101/reject",
            headers={"Authorization": f"Bearer {token}"},
            json={"reason": "Trùng lặp"},
        )
        assert res_reject.status_code == 409
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)
