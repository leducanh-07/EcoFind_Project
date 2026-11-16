"""
Unit and Integration Tests for My Listings API (GET /api/me/listings - TE9C74C).
Use Case: UC-06. Epic: E6. Quản lý tin của tôi.
Acceptance Criteria & Traceability:
- GET /api/me/listings?status= trả tin của chính người dùng.
- Kèm reject_reason nếu bị từ chối và cờ hidden_by_admin.
- Dùng chỉ mục idx_listings_seller trên cột seller_id.
- Phân quyền: Yêu cầu xác thực (401 khi chưa đăng nhập).
- Hỗ trợ lọc theo trạng thái: pending, selling, rejected, sold, hidden (trả 400 nếu status không hợp lệ).
- Truy vết: FR-10.
"""

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db
from app.core.dependencies import user_repo
from app.core.security import create_access_token
from app.models.category import Category
from app.models.listing import Listing
from app.models.listing_photo import ListingPhoto
from app.models.user import User

client = TestClient(app)


@pytest.fixture
def mock_user_a():
    return User(
        user_id=1,
        full_name="Nguyễn Văn A",
        email="user_a@ecofind.vn",
        phone="0911111111",
        password_hash="hash_a",
        role="user",
    )


@pytest.fixture
def mock_user_b():
    return User(
        user_id=2,
        full_name="Trần Thị B",
        email="user_b@ecofind.vn",
        phone="0922222222",
        password_hash="hash_b",
        role="user",
    )


@pytest.fixture
def mock_category():
    return Category(
        category_id=1,
        name="Đồ điện tử",
    )


@pytest.fixture
def user_a_listings(mock_user_a, mock_category):
    now = datetime.now(timezone.utc)

    # 1. Tin đang bán (selling)
    l1 = Listing(
        listing_id=101,
        seller_id=mock_user_a.user_id,
        category_id=mock_category.category_id,
        title="Tai nghe Sony WH-1000XM4",
        description="Tai nghe chống ồn tốt, còn bảo hành 2 tháng.",
        price=Decimal("3500000"),
        address="123 Lê Lợi, Quận 1, TP.HCM",
        lat=10.7725,
        lng=106.6980,
        score_appearance=Decimal("8.5"),
        score_function=Decimal("9.0"),
        score_accessories=Decimal("8.0"),
        total_score=Decimal("8.6"),
        status="selling",
        reject_reason=None,
        hidden_by_admin=False,
        created_at=now,
    )
    l1.category = mock_category
    l1.photos = [
        ListingPhoto(photo_id=1, listing_id=101, url="/uploads/sony1.jpg", sort_order=0),
    ]

    # 2. Tin bị từ chối (rejected) kèm reject_reason
    l2 = Listing(
        listing_id=102,
        seller_id=mock_user_a.user_id,
        category_id=mock_category.category_id,
        title="Điện thoại iPhone 11 vỡ màn hình",
        description="Máy vỡ nát kính, không lên nguồn.",
        price=Decimal("1200000"),
        address="123 Lê Lợi, Quận 1, TP.HCM",
        lat=10.7725,
        lng=106.6980,
        score_appearance=Decimal("2.0"),
        score_function=Decimal("1.0"),
        score_accessories=Decimal("3.0"),
        total_score=Decimal("1.8"),
        status="rejected",
        reject_reason="Hình ảnh chụp quá mờ và sản phẩm hư hỏng hoàn toàn không thể tái sử dụng",
        hidden_by_admin=False,
        created_at=now,
    )
    l2.category = mock_category
    l2.photos = [
        ListingPhoto(photo_id=2, listing_id=102, url="/uploads/iphone_broken.jpg", sort_order=0),
    ]

    # 3. Tin đang chờ duyệt (pending)
    l3 = Listing(
        listing_id=103,
        seller_id=mock_user_a.user_id,
        category_id=mock_category.category_id,
        title="Bàn phím cơ Keychron K2",
        description="Bàn phím gõ êm, đầy đủ phụ kiện cáp và keycap puller.",
        price=Decimal("1100000"),
        address="123 Lê Lợi, Quận 1, TP.HCM",
        lat=10.7725,
        lng=106.6980,
        score_appearance=Decimal("9.0"),
        score_function=Decimal("9.0"),
        score_accessories=Decimal("9.0"),
        total_score=Decimal("9.0"),
        status="pending",
        reject_reason=None,
        hidden_by_admin=False,
        created_at=now,
    )
    l3.category = mock_category
    l3.photos = [
        ListingPhoto(photo_id=3, listing_id=103, url="/uploads/keychron.jpg", sort_order=0),
    ]

    # 4. Tin bị ẩn bởi Admin (hidden_by_admin = True)
    l4 = Listing(
        listing_id=104,
        seller_id=mock_user_a.user_id,
        category_id=mock_category.category_id,
        title="Đồng hồ thông minh Garmin Forerunner",
        description="Bị người mua báo cáo sai lệch thông tin.",
        price=Decimal("4500000"),
        address="123 Lê Lợi, Quận 1, TP.HCM",
        lat=10.7725,
        lng=106.6980,
        score_appearance=Decimal("7.0"),
        score_function=Decimal("7.0"),
        score_accessories=Decimal("7.0"),
        total_score=Decimal("7.0"),
        status="hidden",
        reject_reason=None,
        hidden_by_admin=True,
        created_at=now,
    )
    l4.category = mock_category
    l4.photos = []

    return [l1, l2, l3, l4]


@pytest.fixture(autouse=True)
def override_db_dependency():
    """Tự động override get_db để tránh kết nối database thật gây timeout."""
    mock_db = AsyncMock()

    async def _get_db():
        yield mock_db

    app.dependency_overrides[get_db] = _get_db
    yield mock_db
    app.dependency_overrides.pop(get_db, None)


def test_get_my_listings_unauthorized_401():
    """Chưa đăng nhập khi gọi API xem tin của tôi nhận HTTP 401 Unauthorized (SDD 2.1)."""
    res = client.get("/api/me/listings")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == 401


def test_get_my_listings_only_returns_own_listings(mock_user_a, user_a_listings):
    """
    Chỉ trả về các tin đăng thuộc quyền sở hữu của chính người dùng (seller_id = current_user.user_id).
    Tận dụng chỉ mục idx_listings_seller (FR-10, UC-06).
    """
    token = create_access_token({"sub": str(mock_user_a.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_user_a)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = user_a_listings
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.get(
            "/api/me/listings",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) == 4
        # Xác minh tất cả tin trả về đều là tin của User A
        for item in data:
            assert item["id"] in [101, 102, 103, 104]
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_get_my_listings_filter_by_status_pending(mock_user_a, user_a_listings):
    """Lọc tin theo trạng thái pending: ?status=pending."""
    token = create_access_token({"sub": str(mock_user_a.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_user_a)

    pending_only = [l for l in user_a_listings if l.status == "pending"]

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = pending_only
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.get(
            "/api/me/listings?status=pending",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["id"] == 103
        assert data[0]["status"] == "pending"
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_get_my_listings_filter_by_status_rejected_includes_reason(mock_user_a, user_a_listings):
    """
    Lọc tin bị từ chối: ?status=rejected.
    Tiêu chí: Trả về kèm reject_reason để người bán biết lý do và sửa đổi (FR-10).
    """
    token = create_access_token({"sub": str(mock_user_a.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_user_a)

    rejected_only = [l for l in user_a_listings if l.status == "rejected"]

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = rejected_only
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.get(
            "/api/me/listings?status=rejected",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        item = data[0]
        assert item["id"] == 102
        assert item["status"] == "rejected"
        reason = item.get("rejectReason") or item.get("reject_reason")
        assert reason == "Hình ảnh chụp quá mờ và sản phẩm hư hỏng hoàn toàn không thể tái sử dụng"
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_get_my_listings_includes_hidden_by_admin_flag(mock_user_a, user_a_listings):
    """
    Tiêu chí: Trả về kèm cờ hidden_by_admin cho biết tin có bị quản trị viên ẩn hay không.
    """
    token = create_access_token({"sub": str(mock_user_a.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_user_a)

    hidden_only = [l for l in user_a_listings if l.hidden_by_admin]

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = hidden_only
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.get(
            "/api/me/listings?status=hidden",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        item = data[0]
        assert item["id"] == 104
        hidden_flag = item.get("hiddenByAdmin") if "hiddenByAdmin" in item else item.get("hidden_by_admin")
        assert hidden_flag is True
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_get_my_listings_invalid_status_400(mock_user_a):
    """Truyền trạng thái không hợp lệ trong param status trả về HTTP 400 Bad Request."""
    token = create_access_token({"sub": str(mock_user_a.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_user_a)

    try:
        res = client.get(
            "/api/me/listings?status=invalid_status_xyz",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == 400
        assert "không hợp lệ" in res.json()["error"]["message"]
    finally:
        user_repo.find_by_id = orig_find_user


def test_get_my_listings_empty_string_status_returns_all(mock_user_a, user_a_listings):
    """Khi param status rỗng (?status=), API hiểu là không lọc trạng thái và trả về tất cả."""
    token = create_access_token({"sub": str(mock_user_a.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_user_a)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = user_a_listings
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.get(
            "/api/me/listings?status=",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 4
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_get_my_listings_empty_when_no_listings(mock_user_b):
    """Người dùng chưa đăng tin nào thì trả về mảng rỗng `[]` và HTTP 200."""
    token = create_access_token({"sub": str(mock_user_b.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_user_b)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalars.return_value.all.return_value = []
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.get(
            "/api/me/listings",
            headers={"Authorization": f"Bearer {token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert isinstance(data, list)
        assert len(data) == 0
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)
