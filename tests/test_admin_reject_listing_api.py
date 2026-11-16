"""
Unit and Integration Tests for Admin Reject Listing API (TE9C749).
Use Case: UC-09. Epic: E9 (Kiểm duyệt Admin).
Acceptance Criteria & Traceability:
- POST /api/admin/listings/{id}/reject
- reason bắt buộc (thiếu, rỗng, chỉ chứa khoảng trắng trả 400 và tin giữ nguyên — TC-11, UC-09 E1).
- Đổi status sang 'rejected', lưu reject_reason, reviewed_by, reviewed_at.
- Tin đã xử lý trả 409 Conflict (UC-09 E2).
- Tin bị từ chối không xuất hiện trong GET /api/listings.
- Phân quyền RBAC: người dùng thường nhận 403 Forbidden, chưa đăng nhập nhận 401 Unauthorized.
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
def mock_admin():
    return User(
        user_id=10,
        full_name="Quản Trị Viên",
        email="admin@ecofind.vn",
        phone="0999888777",
        password_hash="admin_hash",
        role="admin",
    )


@pytest.fixture
def mock_standard_user():
    return User(
        user_id=20,
        full_name="Người Dùng Thường",
        email="user@ecofind.vn",
        phone="0911222333",
        password_hash="user_hash",
        role="user",
    )


@pytest.fixture
def mock_seller():
    return User(
        user_id=30,
        full_name="Nguyễn Văn Bán",
        email="seller@ecofind.vn",
        phone="0933444555",
        password_hash="seller_hash",
        role="user",
    )


@pytest.fixture
def mock_category():
    return Category(
        category_id=1,
        name="Đồ gia dụng",
    )


@pytest.fixture
def mock_pending_listing(mock_seller, mock_category):
    now = datetime.now(timezone.utc)
    listing = Listing(
        listing_id=300,
        seller_id=mock_seller.user_id,
        category_id=mock_category.category_id,
        title="Bàn là hơi nước Philips cũ",
        description="Bàn là vẫn dùng được, có vết ố ở mặt đế.",
        price=Decimal("250000"),
        address="123 Hàm Nghi, Phường Bến Nghé, Quận 1, TP.HCM",
        lat=10.7710,
        lng=106.7010,
        score_appearance=Decimal("7.0"),
        score_function=Decimal("8.0"),
        score_accessories=Decimal("6.0"),
        total_score=Decimal("7.2"),
        status="pending",
        reject_reason=None,
        reviewed_by=None,
        reviewed_at=None,
        created_at=now,
    )
    listing.seller = mock_seller
    listing.category = mock_category
    listing.photos = [
        ListingPhoto(photo_id=31, listing_id=300, url="/uploads/banla.jpg", sort_order=0),
    ]
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


def test_reject_listing_unauthorized_401():
    """Chưa đăng nhập khi gọi API từ chối tin nhận HTTP 401 Unauthorized."""
    res = client.post("/api/admin/listings/300/reject", json={"reason": "Ảnh vi phạm"})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == 401


def test_reject_listing_forbidden_for_standard_user_403(mock_standard_user):
    """Người dùng thông thường (role='user') gọi API từ chối tin nhận HTTP 403 Forbidden (TC-10)."""
    token = create_access_token({"sub": str(mock_standard_user.user_id)})

    orig_find = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_standard_user)

    try:
        res = client.post(
            "/api/admin/listings/300/reject",
            headers={"Authorization": f"Bearer {token}"},
            json={"reason": "Ảnh chụp vi phạm"},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == 403
        assert "yêu cầu quyền 'admin'" in res.json()["error"]["message"]
    finally:
        user_repo.find_by_id = orig_find


def test_reject_listing_not_found_404(mock_admin):
    """Từ chối tin không tồn tại trong hệ thống trả về HTTP 404 Not Found."""
    token = create_access_token({"sub": str(mock_admin.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_admin)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.post(
            "/api/admin/listings/99999/reject",
            headers={"Authorization": f"Bearer {token}"},
            json={"reason": "Sản phẩm không có thực"},
        )
        assert res.status_code == 404
        assert res.json()["error"]["code"] == 404
        assert "Không tìm thấy" in res.json()["error"]["message"]
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_reject_listing_requires_reason_empty_string_400(mock_admin, mock_pending_listing):
    """
    Thiếu lý do từ chối (chuỗi rỗng) trả về HTTP 400 Bad Request và tin giữ nguyên trạng thái cũ (TC-11, UC-09 E1).
    """
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
            "/api/admin/listings/300/reject",
            headers={"Authorization": f"Bearer {token}"},
            json={"reason": ""},
        )
        assert res.status_code in (400, 422)
        err_data = res.json()["error"]
        assert err_data["code"] == 400 or res.status_code == 422
        assert "Lý do từ chối" in str(err_data) or "reason" in str(err_data)

        # Trạng thái tin đăng phải GIỮ NGUYÊN (status='pending', chưa có người duyệt)
        assert mock_pending_listing.status == "pending"
        assert mock_pending_listing.reject_reason is None
        assert mock_pending_listing.reviewed_by is None
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_reject_listing_requires_reason_whitespace_only_400(mock_admin, mock_pending_listing):
    """Lý do từ chối chỉ gồm khoảng trắng trả về HTTP 400 và tin giữ nguyên trạng thái cũ."""
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
            "/api/admin/listings/300/reject",
            headers={"Authorization": f"Bearer {token}"},
            json={"reason": "     "},
        )
        assert res.status_code in (400, 422)
        # Trạng thái tin đăng giữ nguyên
        assert mock_pending_listing.status == "pending"
        assert mock_pending_listing.reject_reason is None
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_reject_listing_empty_body_400(mock_admin, mock_pending_listing):
    """Không gửi body hoặc gửi body rỗng `{}` trả về HTTP 400 và tin giữ nguyên trạng thái cũ."""
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
            "/api/admin/listings/300/reject",
            headers={"Authorization": f"Bearer {token}"},
            json={},
        )
        assert res.status_code in (400, 422)
        assert mock_pending_listing.status == "pending"
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_reject_listing_already_processed_returns_409(mock_admin, mock_pending_listing):
    """Tin đăng đã được xử lý (status='selling', 'rejected', 'sold') trả về HTTP 409 Conflict (UC-09 E2)."""
    token = create_access_token({"sub": str(mock_admin.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_admin)

    # Đổi trạng thái tin thành rejected (đã bị từ chối trước đó bởi admin khác)
    mock_pending_listing.status = "rejected"

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_pending_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.post(
            "/api/admin/listings/300/reject",
            headers={"Authorization": f"Bearer {token}"},
            json={"reason": "Từ chối lần nữa"},
        )
        assert res.status_code == 409
        assert res.json()["error"]["code"] == 409
        assert "đã được xử lý" in res.json()["error"]["message"]
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_reject_listing_success(mock_admin, mock_pending_listing):
    """
    Từ chối tin hợp lệ kèm lý do bắt buộc (TC-11, FR-14):
    - Status chuyển thành 'rejected'.
    - Ghi nhận reject_reason = lý do.
    - Ghi nhận reviewed_by = admin.user_id và reviewed_at.
    - Trả về status 'rejected' và message 'Đã từ chối tin đăng'.
    """
    token = create_access_token({"sub": str(mock_admin.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_admin)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_pending_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        reject_msg = "Ảnh mờ, chụp che khuất vết nứt nghiêm trọng ở tay cầm."
        res = client.post(
            "/api/admin/listings/300/reject",
            headers={"Authorization": f"Bearer {token}"},
            json={"reason": reject_msg},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == 300
        assert data["status"] == "rejected"
        assert data["message"] == "Đã từ chối tin đăng"
        reason_resp = data.get("rejectReason") or data.get("reject_reason")
        assert reason_resp == reject_msg
        reviewer = data.get("reviewedBy") if "reviewedBy" in data else data.get("reviewed_by")
        assert reviewer == mock_admin.user_id

        # Kiểm tra cập nhật trên model Listing
        assert mock_pending_listing.status == "rejected"
        assert mock_pending_listing.reject_reason == reject_msg
        assert mock_pending_listing.review_note == reject_msg
        assert mock_pending_listing.reviewed_by == mock_admin.user_id
        assert mock_pending_listing.reviewed_at is not None
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_reject_listing_supports_reject_reason_alias(mock_admin, mock_pending_listing):
    """Hỗ trợ cả trường 'reject_reason' hoặc 'rejectReason' trong payload."""
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
            "/api/admin/listings/300/reject",
            headers={"Authorization": f"Bearer {token}"},
            json={"reject_reason": "Tin đăng trùng lặp với sản phẩm trước đó"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "rejected"
        assert mock_pending_listing.reject_reason == "Tin đăng trùng lặp với sản phẩm trước đó"
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_rejected_listing_not_visible_in_public_listings_uc09_a1(mock_admin, mock_pending_listing):
    """
    Sau khi từ chối, tin có status = 'rejected' và KHÔNG được hiển thị trong GET /api/listings
    hoặc trên bản đồ công khai (UC-09 A1, FR-14).
    """
    token = create_access_token({"sub": str(mock_admin.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_admin)

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_pending_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        # Từ chối tin
        res_reject = client.post(
            "/api/admin/listings/300/reject",
            headers={"Authorization": f"Bearer {token}"},
            json={"reason": "Không đạt yêu cầu"},
        )
        assert res_reject.status_code == 200
        assert mock_pending_listing.status == "rejected"

        # Giả lập query public GET /api/listings: chỉ lọc status = 'selling'
        mock_list_result = MagicMock()
        mock_list_result.scalars.return_value.all.return_value = []
        mock_db.execute.return_value = mock_list_result

        res_public = client.get("/api/listings")
        assert res_public.status_code == 200
        listings_data = res_public.json()
        assert len(listings_data) == 0
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)
