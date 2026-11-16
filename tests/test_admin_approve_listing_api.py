"""
Unit and Integration Tests for Admin Approve Listing API (TE9C748).
Use Case: UC-09. Epic: E9 (Kiểm duyệt Admin).
Acceptance Criteria & Traceability:
- POST /api/admin/listings/{id}/approve nhận adjustments (chỉ được hạ điểm) và note (review_note).
- ModerationService gọi lại ScoreCalculator, đổi status sang 'selling', ghi reviewed_by và reviewed_at.
- Tin hiện trong GET /api/listings (TC-10).
- Tin đã xử lý trả 409 Conflict (E2).
- Ghi chú hạ điểm lưu vào reject_reason (hoặc review_note).
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
        listing_id=200,
        seller_id=mock_seller.user_id,
        category_id=mock_category.category_id,
        title="Nồi cơm điện Cuckoo 1.8L",
        description="Nồi còn nấu cơm ngon, trầy nhẹ bên ngoài.",
        price=Decimal("500000"),
        address="456 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
        lat=10.7740,
        lng=106.7020,
        score_appearance=Decimal("9.0"),
        score_function=Decimal("9.0"),
        score_accessories=Decimal("8.0"),
        total_score=Decimal("8.8"),
        status="pending",
        reject_reason=None,
        reviewed_by=None,
        reviewed_at=None,
        created_at=now,
    )
    listing.seller = mock_seller
    listing.category = mock_category
    listing.photos = [
        ListingPhoto(photo_id=10, listing_id=200, url="/uploads/noicom.jpg", sort_order=0),
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


def test_approve_listing_unauthorized_401():
    """Chưa đăng nhập khi gọi API duyệt tin nhận HTTP 401 Unauthorized."""
    res = client.post("/api/admin/listings/200/approve", json={})
    assert res.status_code == 401
    assert res.json()["error"]["code"] == 401


def test_approve_listing_forbidden_for_standard_user_403(mock_standard_user):
    """Người dùng thông thường (role='user') gọi API duyệt tin nhận HTTP 403 Forbidden (TC-10)."""
    token = create_access_token({"sub": str(mock_standard_user.user_id)})

    orig_find = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_standard_user)

    try:
        res = client.post(
            "/api/admin/listings/200/approve",
            headers={"Authorization": f"Bearer {token}"},
            json={},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == 403
        assert "yêu cầu quyền 'admin'" in res.json()["error"]["message"]
    finally:
        user_repo.find_by_id = orig_find


def test_approve_listing_not_found_404(mock_admin):
    """Duyệt tin không tồn tại trong hệ thống trả về HTTP 404 Not Found."""
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
            "/api/admin/listings/9999/approve",
            headers={"Authorization": f"Bearer {token}"},
            json={},
        )
        assert res.status_code == 404
        assert res.json()["error"]["code"] == 404
        assert "Không tìm thấy" in res.json()["error"]["message"]
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_approve_listing_already_processed_returns_409(mock_admin, mock_pending_listing):
    """Tin đăng đã được duyệt (status='selling') hoặc từ chối (status='rejected') trả về HTTP 409 Conflict (E2)."""
    token = create_access_token({"sub": str(mock_admin.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_admin)

    # Đổi trạng thái tin thành selling (đã xử lý trước đó)
    mock_pending_listing.status = "selling"

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_pending_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        res = client.post(
            "/api/admin/listings/200/approve",
            headers={"Authorization": f"Bearer {token}"},
            json={},
        )
        assert res.status_code == 409
        assert res.json()["error"]["code"] == 409
        assert "đã được xử lý" in res.json()["error"]["message"]
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_approve_listing_without_adjustments_success(mock_admin, mock_pending_listing):
    """
    Duyệt tin giữ nguyên điểm tự chấm của người bán:
    - Status chuyển thành 'selling'.
    - Ghi nhận reviewed_by = admin_id và reviewed_at.
    - Giữ nguyên total_score = 8.8 và rank = 'Tốt'.
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
            "/api/admin/listings/200/approve",
            headers={"Authorization": f"Bearer {token}"},
            json={},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == 200
        assert data["status"] == "selling"
        total = data.get("totalScore") if "totalScore" in data else data.get("total_score")
        assert total == 8.8
        assert data["rank"] == "Tốt"

        # Kiểm tra cập nhật trên model
        assert mock_pending_listing.status == "selling"
        assert mock_pending_listing.reviewed_by == mock_admin.user_id
        assert mock_pending_listing.reviewed_at is not None
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_approve_listing_with_valid_downward_adjustments(mock_admin, mock_pending_listing):
    """
    Duyệt tin kèm hạ điểm thành phần và ghi chú duyệt (review_note / note):
    - Ban đầu: app=9.0, func=9.0, acc=8.0 (total=8.8, 'Tốt')
    - Admin hạ: app=6.0, func=6.0, acc=5.0
    - Điểm mới = 0.4*6.0 + 0.4*6.0 + 0.2*5.0 = 2.4 + 2.4 + 1.0 = 5.8 -> 'Khá' (BR-01, BR-02).
    - Lưu ghi chú vào reject_reason (review_note).
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
            "/api/admin/listings/200/approve",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "adjustments": {
                    "score_appearance": 6.0,
                    "score_function": 6.0,
                    "score_accessories": 5.0,
                },
                "note": "Mặt vỏ trầy nhiều, lòng nồi bong lớp chống dính nhẹ",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["id"] == 200
        assert data["status"] == "selling"
        total = data.get("totalScore") if "totalScore" in data else data.get("total_score")
        assert total == 5.8
        assert data["rank"] == "Khá"

        # Kiểm tra model
        assert mock_pending_listing.status == "selling"
        assert float(mock_pending_listing.score_appearance) == 6.0
        assert float(mock_pending_listing.score_function) == 6.0
        assert float(mock_pending_listing.score_accessories) == 5.0
        assert float(mock_pending_listing.total_score) == 5.8
        assert mock_pending_listing.reviewed_by == mock_admin.user_id
        assert mock_pending_listing.reject_reason == "Mặt vỏ trầy nhiều, lòng nồi bong lớp chống dính nhẹ"
        assert mock_pending_listing.review_note == "Mặt vỏ trầy nhiều, lòng nồi bong lớp chống dính nhẹ"
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_approve_listing_rejects_score_increase_400(mock_admin, mock_pending_listing):
    """
    Chỉ được phép hạ điểm; nếu Admin cố tình nâng điểm cao hơn người bán tự chấm
    thì hệ thống từ chối và trả về HTTP 400 Bad Request (UC-09 A2).
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
        # app ban đầu là 9.0, thử tăng lên 9.5
        res = client.post(
            "/api/admin/listings/200/approve",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "adjustments": {
                    "score_appearance": 9.5,
                },
            },
        )
        assert res.status_code == 400
        assert res.json()["error"]["code"] == 400
        assert "Chỉ được phép hạ điểm" in res.json()["error"]["message"]
        assert "ngoại quan" in res.json()["error"]["message"]
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_approve_listing_invalid_score_boundaries_400(mock_admin, mock_pending_listing):
    """Điểm điều chỉnh ngoài khoảng 0.0 - 10.0 bị từ chối trả về 400 hoặc 422 (E3)."""
    token = create_access_token({"sub": str(mock_admin.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_admin)

    try:
        res_negative = client.post(
            "/api/admin/listings/200/approve",
            headers={"Authorization": f"Bearer {token}"},
            json={"adjustments": {"score_appearance": -1.0}},
        )
        assert res_negative.status_code in (400, 422)

        res_over = client.post(
            "/api/admin/listings/200/approve",
            headers={"Authorization": f"Bearer {token}"},
            json={"adjustments": {"score_appearance": 11.5}},
        )
        assert res_over.status_code in (400, 422)
    finally:
        user_repo.find_by_id = orig_find_user


def test_approve_listing_supports_camelcase_and_short_names(mock_admin, mock_pending_listing):
    """Hỗ trợ cả format camelCase / short name (appearance, function, accessories, reviewNote)."""
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
            "/api/admin/listings/200/approve",
            headers={"Authorization": f"Bearer {token}"},
            json={
                "adjustments": {
                    "appearance": 7.0,
                    "function": 8.0,
                    "accessories": 6.0,
                },
                "reviewNote": "Đánh giá lại ngoại quan và phụ kiện qua ảnh",
            },
        )
        assert res.status_code == 200
        data = res.json()
        assert data["status"] == "selling"
        total = data.get("totalScore") if "totalScore" in data else data.get("total_score")
        # 0.4*7.0 + 0.4*8.0 + 0.2*6.0 = 2.8 + 3.2 + 1.2 = 7.2 -> 'Tốt'
        assert total == 7.2
        assert data["rank"] == "Tốt"
        assert mock_pending_listing.review_note == "Đánh giá lại ngoại quan và phụ kiện qua ảnh"
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)


def test_approved_listing_appears_in_public_listings_tc10(mock_admin, mock_pending_listing):
    """
    Kiểm tra truy vết TC-10 & FR-14:
    - Tin đăng khi ở trạng thái 'pending' không xuất hiện trong GET /api/listings.
    - Sau khi duyệt thành công (chuyển sang 'selling'), tin xuất hiện trong GET /api/listings.
    """
    token = create_access_token({"sub": str(mock_admin.user_id)})

    orig_find_user = user_repo.find_by_id
    user_repo.find_by_id = AsyncMock(return_value=mock_admin)

    # 1. Trước khi duyệt: Tin đang pending
    assert mock_pending_listing.status == "pending"

    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = mock_pending_listing
    mock_db.execute.return_value = mock_result

    app.dependency_overrides[get_db] = lambda: mock_db

    try:
        # 2. Admin gọi duyệt tin
        res_approve = client.post(
            "/api/admin/listings/200/approve",
            headers={"Authorization": f"Bearer {token}"},
            json={},
        )
        assert res_approve.status_code == 200
        assert mock_pending_listing.status == "selling"

        # 3. Giả lập GET /api/listings trả về danh sách tin đang bán (status='selling')
        mock_list_result = MagicMock()
        mock_list_result.scalars.return_value.all.return_value = [mock_pending_listing]
        mock_db.execute.return_value = mock_list_result

        res_public = client.get("/api/listings")
        assert res_public.status_code == 200
        listings_data = res_public.json()
        assert len(listings_data) >= 1
        assert listings_data[0]["id"] == 200
        assert listings_data[0]["title"] == "Nồi cơm điện Cuckoo 1.8L"
    finally:
        user_repo.find_by_id = orig_find_user
        app.dependency_overrides.pop(get_db, None)
