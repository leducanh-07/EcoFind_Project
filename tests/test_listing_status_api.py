"""
Unit and Integration Tests for Update Listing Status API (PATCH /api/listings/{id}/status - TE9C74E).
Use Case: UC-06. Epic: E6 (Quản lý tin của tôi).
Acceptance Criteria & Traceability:
- PATCH /api/listings/{id}/status nhận hidden, selling hoặc sold theo bảng chuyển trạng thái SDD 4.2.
- Tin pending đánh dấu sold trả 409 Conflict (E1).
- Tin do Admin ẩn (hidden_by_admin) hiện lại trả 403 Forbidden (E3).
- Chỉ chủ tin (hoặc Admin) mới được phép thao tác (check_listing_owner - NFR-SEC-03, TC-08).
- Chưa đăng nhập trả 401 Unauthorized.
- Tin không tồn tại trả 404 Not Found.
- Trạng thái không hợp lệ trả 400 Bad Request.
- Truy vết: FR-10, UC-06 E1 E3.
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
from app.models.user import User

client = TestClient(app)


@pytest.fixture
def mock_owner():
    return User(
        user_id=1,
        full_name="Nguyễn Văn Chủ Tin",
        email="owner@ecofind.vn",
        phone="0911111111",
        password_hash="owner_hash",
        role="user",
    )


@pytest.fixture
def mock_other_user():
    return User(
        user_id=2,
        full_name="Người Dùng Khác",
        email="other@ecofind.vn",
        phone="0922222222",
        password_hash="other_hash",
        role="user",
    )


@pytest.fixture
def mock_admin():
    return User(
        user_id=99,
        full_name="Quản Trị Viên",
        email="admin@ecofind.vn",
        phone="0999999999",
        password_hash="admin_hash",
        role="admin",
    )


@pytest.fixture
def mock_category():
    return Category(
        category_id=1,
        name="Đồ gia dụng",
    )


@pytest.fixture
def mock_selling_listing(mock_owner, mock_category):
    now = datetime.now(timezone.utc)
    listing = Listing(
        listing_id=101,
        seller_id=mock_owner.user_id,
        category_id=mock_category.category_id,
        title="Quạt bàn Senko",
        description="Quạt chạy êm, 3 cấp độ gió.",
        price=Decimal("150000"),
        address="123 Lê Lợi, Quận 1, TP.HCM",
        lat=10.7725,
        lng=106.6980,
        score_appearance=Decimal("8.0"),
        score_function=Decimal("9.0"),
        score_accessories=Decimal("7.0"),
        total_score=Decimal("8.2"),
        status="selling",
        reject_reason=None,
        hidden_by_admin=False,
        created_at=now,
    )
    listing.category = mock_category
    listing.photos = []
    return listing


@pytest.fixture
def mock_pending_listing(mock_owner, mock_category):
    now = datetime.now(timezone.utc)
    listing = Listing(
        listing_id=102,
        seller_id=mock_owner.user_id,
        category_id=mock_category.category_id,
        title="Bếp điện từ Sunhouse",
        description="Bếp mới mua 1 tháng.",
        price=Decimal("600000"),
        address="123 Lê Lợi, Quận 1, TP.HCM",
        lat=10.7725,
        lng=106.6980,
        score_appearance=Decimal("9.0"),
        score_function=Decimal("9.0"),
        score_accessories=Decimal("8.0"),
        total_score=Decimal("8.8"),
        status="pending",
        reject_reason=None,
        hidden_by_admin=False,
        created_at=now,
    )
    listing.category = mock_category
    listing.photos = []
    return listing


@pytest.fixture
def mock_admin_hidden_listing(mock_owner, mock_category):
    now = datetime.now(timezone.utc)
    listing = Listing(
        listing_id=103,
        seller_id=mock_owner.user_id,
        category_id=mock_category.category_id,
        title="Bình nước giữ nhiệt bị vi phạm",
        description="Bị báo cáo sai lệch thông tin nghiêm trọng.",
        price=Decimal("200000"),
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
    listing.category = mock_category
    listing.photos = []
    return listing


@pytest.fixture
def mock_seller_hidden_listing(mock_owner, mock_category):
    now = datetime.now(timezone.utc)
    listing = Listing(
        listing_id=104,
        seller_id=mock_owner.user_id,
        category_id=mock_category.category_id,
        title="Bàn làm việc gỗ thông",
        description="Chủ tin tạm ẩn đi công tác.",
        price=Decimal("800000"),
        address="123 Lê Lợi, Quận 1, TP.HCM",
        lat=10.7725,
        lng=106.6980,
        score_appearance=Decimal("8.0"),
        score_function=Decimal("8.0"),
        score_accessories=Decimal("8.0"),
        total_score=Decimal("8.0"),
        status="hidden",
        reject_reason=None,
        hidden_by_admin=False,
        created_at=now,
    )
    listing.category = mock_category
    listing.photos = []
    return listing


@pytest.fixture(autouse=True)
def override_db_dependency():
    """Tự động override get_db để tránh kết nối database thật gây timeout."""
    mock_db = AsyncMock()

    async def _get_db():
        yield mock_db

    app.dependency_overrides[get_db] = _get_db
    yield mock_db
    app.dependency_overrides.pop(get_db, None)


def test_update_status_unauthorized_401():
    """Chưa đăng nhập khi gọi API đổi trạng thái nhận HTTP 401 Unauthorized (SDD 2.1)."""
    res = client.patch("/api/listings/101/status", json={"status": "hidden"})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == 401


def test_update_status_forbidden_not_owner_403(mock_other_user, mock_selling_listing):
    """
    Người dùng không phải chủ tin thao tác đổi trạng thái nhận HTTP 403 Forbidden (NFR-SEC-03, TC-08).
    """
    token = create_access_token({"sub": str(mock_other_user.user_id)})

    orig_find = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_other_user)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_selling_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.patch(
            "/api/listings/101/status",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "hidden"},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == 403
        assert "không có quyền" in res.json()["error"]["message"]
    finally:
        user_repo.find_by_id = orig_find
        app.dependency_overrides.pop(get_db, None)


def test_update_status_not_found_404(mock_owner):
    """Tin đăng không tồn tại trong hệ thống trả về HTTP 404 Not Found."""
    token = create_access_token({"sub": str(mock_owner.user_id)})

    orig_find = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_owner)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.patch(
            "/api/listings/99999/status",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "hidden"},
        )
        assert res.status_code == 404
        assert res.json()["error"]["code"] == 404
        assert "Không tìm thấy" in res.json()["error"]["message"]
    finally:
        user_repo.find_by_id = orig_find
        app.dependency_overrides.pop(get_db, None)


def test_update_status_invalid_status_400(mock_owner, mock_selling_listing):
    """Gửi trạng thái không hợp lệ (không phải hidden, selling, sold) trả về HTTP 400."""
    token = create_access_token({"sub": str(mock_owner.user_id)})

    orig_find = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_owner)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_selling_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.patch(
            "/api/listings/101/status",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "invalid_status"},
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == 400
        assert "không hợp lệ" in res.json()["error"]["message"]
    finally:
        user_repo.find_by_id = orig_find
        app.dependency_overrides.pop(get_db, None)


def test_update_status_pending_to_sold_conflict_409_e1(mock_owner, mock_pending_listing):
    """
    Tiêu chí E1: Tin đang pending đánh dấu sold trả về HTTP 409 Conflict (UC-06 E1, SDD 4.2).
    """
    token = create_access_token({"sub": str(mock_owner.user_id)})

    orig_find = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_owner)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_pending_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.patch(
            "/api/listings/102/status",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "sold"},
        )
        assert res.status_code == 409
        assert res.json()["error"]["code"] == 409
        assert "chờ duyệt không được phép đánh dấu đã bán" in res.json()["error"]["message"]
        # Trạng thái giữ nguyên
        assert mock_pending_listing.status == "pending"
    finally:
        user_repo.find_by_id = orig_find
        app.dependency_overrides.pop(get_db, None)


def test_update_status_hidden_by_admin_to_selling_forbidden_403_e3(mock_owner, mock_admin_hidden_listing):
    """
    Tiêu chí E3: Tin do Admin ẩn (hidden_by_admin = True) người bán hiện lại trả về HTTP 403 Forbidden (UC-06 E3).
    """
    token = create_access_token({"sub": str(mock_owner.user_id)})

    orig_find = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_owner)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_admin_hidden_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.patch(
            "/api/listings/103/status",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "selling"},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == 403
        assert "Quản trị viên ẩn" in res.json()["error"]["message"]
        # Trạng thái giữ nguyên
        assert mock_admin_hidden_listing.status == "hidden"
    finally:
        user_repo.find_by_id = orig_find
        app.dependency_overrides.pop(get_db, None)


def test_update_status_seller_hidden_to_selling_success(mock_owner, mock_seller_hidden_listing):
    """
    Tin do chính người bán ẩn (hidden_by_admin = False), người bán hiện lại thành công (selling).
    """
    token = create_access_token({"sub": str(mock_owner.user_id)})

    orig_find = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_owner)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_seller_hidden_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.patch(
            "/api/listings/104/status",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "selling"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == 104
        assert data["status"] == "selling"
        assert "hiện lại" in data["message"].lower() or "thành công" in data["message"].lower()
        assert mock_seller_hidden_listing.status == "selling"
    finally:
        user_repo.find_by_id = orig_find
        app.dependency_overrides.pop(get_db, None)


def test_update_status_selling_to_hidden_success(mock_owner, mock_selling_listing):
    """Người bán ẩn tin đang bán thành công (selling -> hidden)."""
    token = create_access_token({"sub": str(mock_owner.user_id)})

    orig_find = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_owner)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_selling_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.patch(
            "/api/listings/101/status",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "hidden"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == 101
        assert data["status"] == "hidden"
        assert mock_selling_listing.status == "hidden"
        assert mock_selling_listing.hidden_by_admin is False
    finally:
        user_repo.find_by_id = orig_find
        app.dependency_overrides.pop(get_db, None)


def test_update_status_selling_to_sold_success(mock_owner, mock_selling_listing):
    """Người bán đánh dấu tin đang bán là đã bán thành công (selling -> sold)."""
    token = create_access_token({"sub": str(mock_owner.user_id)})

    orig_find = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_owner)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_selling_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.patch(
            "/api/listings/101/status",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "sold"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == 101
        assert data["status"] == "sold"
        assert mock_selling_listing.status == "sold"
    finally:
        user_repo.find_by_id = orig_find
        app.dependency_overrides.pop(get_db, None)


def test_update_status_admin_can_override_for_any_listing(mock_admin, mock_selling_listing):
    """Quản trị viên (Admin) có quyền đổi trạng thái tin của người khác."""
    token = create_access_token({"sub": str(mock_admin.user_id)})

    orig_find = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_admin)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_selling_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.patch(
            "/api/listings/101/status",
            headers={"Authorization": f"Bearer {token}"},
            json={"status": "hidden"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "hidden"
        assert mock_selling_listing.status == "hidden"
    finally:
        user_repo.find_by_id = orig_find
        app.dependency_overrides.pop(get_db, None)
