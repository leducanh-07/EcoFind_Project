"""
Unit and Integration Tests for Admin Reports API (TE9C755, UC-08, UC-09, FR-12, FR-15, TC-09).
Acceptance Criteria:
- GET /api/admin/reports?status=new (dùng idx_reports_queue).
- POST /api/admin/reports/{id}/resolve với action = hide (tin sang hidden, hidden_by_admin = true, báo cáo sang resolved) hoặc dismiss (chỉ đóng báo cáo).
- Báo cáo đã xử lý trả 409 Conflict.
- Chỉ role admin (người khác nhận 403 — NFR-SEC-03).
- POST /api/listings/{id}/reports: reason thuộc wrong_score, scam, prohibited, other; note tối đa 200 ký tự; báo cáo lần 2 trả 409; báo cáo tin của chính mình trả 403 (TC-09).
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
from app.models.listing import Listing
from app.models.report import Report
from app.models.user import User

client = TestClient(app)


@pytest.fixture(autouse=True)
def clean_overrides():
    orig = user_repo.find_by_id
    yield
    user_repo.find_by_id = orig
    app.dependency_overrides.clear()


@pytest.fixture
def mock_admin():
    return User(
        user_id=1,
        full_name="Quản Trị Viên",
        email="admin@ecofind.vn",
        phone="0909090909",
        password_hash="fakehash",
        role="admin",
    )


@pytest.fixture
def mock_user_reporter():
    return User(
        user_id=2,
        full_name="Người Tố Cáo",
        email="reporter@ecofind.vn",
        phone="0911112222",
        password_hash="fakehash",
        role="user",
    )


@pytest.fixture
def mock_seller():
    return User(
        user_id=3,
        full_name="Người Bán",
        email="seller@ecofind.vn",
        phone="0933334444",
        password_hash="fakehash",
        role="user",
    )


@pytest.fixture
def admin_token(mock_admin):
    return create_access_token({
        "sub": str(mock_admin.user_id),
        "email": mock_admin.email,
        "role": mock_admin.role,
    })


@pytest.fixture
def user_token(mock_user_reporter):
    return create_access_token({
        "sub": str(mock_user_reporter.user_id),
        "email": mock_user_reporter.email,
        "role": mock_user_reporter.role,
    })


@pytest.fixture
def seller_token(mock_seller):
    return create_access_token({
        "sub": str(mock_seller.user_id),
        "email": mock_seller.email,
        "role": mock_seller.role,
    })


def make_mock_listing(listing_id=10, seller_id=3, status="selling"):
    l = Listing(
        listing_id=listing_id,
        seller_id=seller_id,
        category_id=1,
        title="Laptop văn phòng cũ",
        description="Laptop Core i5",
        price=Decimal("4000000"),
        address="123 Lê Lợi, Q.1",
        lat=10.7769,
        lng=106.7009,
        score_appearance=Decimal("8.0"),
        score_function=Decimal("8.0"),
        score_accessories=Decimal("8.0"),
        total_score=Decimal("8.0"),
        status=status,
        hidden_by_admin=False,
    )
    l.photos = []
    l.seller = User(user_id=seller_id, full_name="Người Bán", email="seller@ecofind.vn")
    return l


def make_mock_report(report_id=1, listing_id=10, reporter_id=2, reason="scam", status="new", listing=None):
    r = Report(
        report_id=report_id,
        listing_id=listing_id,
        reporter_id=reporter_id,
        reason=reason,
        note="Nghi ngờ lừa đảo chuyển cọc trước",
        status=status,
        created_at=datetime(2026, 11, 15, 10, 0, tzinfo=timezone.utc),
    )
    r.listing = listing or make_mock_listing(listing_id=listing_id)
    r.reporter = User(user_id=reporter_id, full_name="Người Tố Cáo", email="reporter@ecofind.vn")
    return r


# -----------------------------------------------------------------------------
# 1. Tests for GET /api/admin/reports
# -----------------------------------------------------------------------------
def test_get_admin_reports_unauthorized():
    """Chưa đăng nhập khi gọi hàng đợi báo cáo nhận 401 Unauthorized."""
    res = client.get("/api/admin/reports")
    assert res.status_code == 401


def test_get_admin_reports_regular_user_forbidden(user_token, mock_user_reporter):
    """User thường khi gọi hàng đợi báo cáo nhận 403 Forbidden (NFR-SEC-03)."""
    mock_db = AsyncMock()

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == mock_user_reporter.user_id:
            return mock_user_reporter
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    res = client.get(
        "/api/admin/reports",
        headers={"Authorization": f"Bearer {user_token}"},
    )
    assert res.status_code == 403

    app.dependency_overrides.clear()


def test_get_admin_reports_success_for_admin(admin_token, mock_admin):
    """Admin xem danh sách báo cáo mới thành công (FR-15)."""
    mock_db = AsyncMock()
    rep1 = make_mock_report(report_id=1, reason="scam")
    rep2 = make_mock_report(report_id=2, reason="wrong_score")

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == mock_admin.user_id:
            return mock_admin
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.report_service import report_service
        mp.setattr(report_service.report_repo, "find_queue", AsyncMock(return_value=[rep1, rep2]))

        res = client.get(
            "/api/admin/reports?status=new",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 2
        assert data[0]["reason"] == "scam"
        assert data[0]["reasonLabel"] == "Lừa đảo"
        assert data[1]["reason"] == "wrong_score"
        assert data[1]["reasonLabel"] == "Sai điểm tình trạng"

    app.dependency_overrides.clear()


# -----------------------------------------------------------------------------
# 2. Tests for POST /api/admin/reports/{id}/resolve
# -----------------------------------------------------------------------------
def test_resolve_report_action_hide(admin_token, mock_admin):
    """Admin xử lý báo cáo với action = hide -> tin sang hidden, hidden_by_admin = true, báo cáo resolved."""
    mock_db = AsyncMock()
    mock_listing = make_mock_listing(listing_id=10, status="selling")
    mock_report = make_mock_report(report_id=1, listing=mock_listing, status="new")

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == mock_admin.user_id:
            return mock_admin
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.report_service import report_service
        mp.setattr(report_service.report_repo, "find_by_id_with_relations", AsyncMock(return_value=mock_report))

        res = client.post(
            "/api/admin/reports/1/resolve",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"action": "hide"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["action"] == "hide"
        assert data["status"] == "resolved"
        assert data["listingStatus"] == "hidden"
        assert mock_listing.status == "hidden"
        assert mock_listing.hidden_by_admin is True
        assert mock_report.status == "resolved"

    app.dependency_overrides.clear()


def test_resolve_report_action_dismiss(admin_token, mock_admin):
    """Admin xử lý báo cáo với action = dismiss -> chỉ đóng báo cáo sang resolved, tin giữ nguyên."""
    mock_db = AsyncMock()
    mock_listing = make_mock_listing(listing_id=10, status="selling")
    mock_report = make_mock_report(report_id=2, listing=mock_listing, status="new")

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == mock_admin.user_id:
            return mock_admin
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.report_service import report_service
        mp.setattr(report_service.report_repo, "find_by_id_with_relations", AsyncMock(return_value=mock_report))

        res = client.post(
            "/api/admin/reports/2/resolve",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"action": "dismiss"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["action"] == "dismiss"
        assert data["status"] == "resolved"
        assert mock_listing.status == "selling"
        assert mock_report.status == "resolved"

    app.dependency_overrides.clear()


def test_resolve_report_already_resolved_conflict(admin_token, mock_admin):
    """Báo cáo đã xử lý khi gọi resolve trả 409 Conflict."""
    mock_db = AsyncMock()
    mock_report = make_mock_report(report_id=1, status="resolved")

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == mock_admin.user_id:
            return mock_admin
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.report_service import report_service
        mp.setattr(report_service.report_repo, "find_by_id_with_relations", AsyncMock(return_value=mock_report))

        res = client.post(
            "/api/admin/reports/1/resolve",
            headers={"Authorization": f"Bearer {admin_token}"},
            json={"action": "hide"},
        )
        assert res.status_code == 409
        assert "đã được xử lý" in res.json()["error"]["message"]

    app.dependency_overrides.clear()


# -----------------------------------------------------------------------------
# 3. Tests for POST /api/listings/{id}/reports (User violation report)
# -----------------------------------------------------------------------------
def test_report_own_listing_forbidden_tc09(seller_token, mock_seller):
    """TC-09: Báo cáo tin của chính mình trả 403 Forbidden."""
    mock_db = AsyncMock()
    mock_listing = make_mock_listing(listing_id=10, seller_id=mock_seller.user_id)

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == mock_seller.user_id:
            return mock_seller
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.report_service import report_service
        mp.setattr(report_service.listing_repo, "find_by_id", AsyncMock(return_value=mock_listing))

        res = client.post(
            "/api/listings/10/reports",
            headers={"Authorization": f"Bearer {seller_token}"},
            json={"reason": "wrong_score", "note": "Tự báo cáo"},
        )
        assert res.status_code == 403
        assert "không thể tự báo cáo" in res.json()["error"]["message"].lower()

    app.dependency_overrides.clear()


def test_report_duplicate_conflict_tc09(user_token, mock_user_reporter, mock_seller):
    """TC-09: Báo cáo cùng một tin lần 2 trả 409 Conflict."""
    mock_db = AsyncMock()
    mock_listing = make_mock_listing(listing_id=10, seller_id=mock_seller.user_id)
    existing_report = make_mock_report(report_id=1, listing_id=10, reporter_id=mock_user_reporter.user_id)

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == mock_user_reporter.user_id:
            return mock_user_reporter
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.report_service import report_service
        mp.setattr(report_service.listing_repo, "find_by_id", AsyncMock(return_value=mock_listing))
        mp.setattr(report_service.report_repo, "find_by_reporter_and_listing", AsyncMock(return_value=existing_report))

        res = client.post(
            "/api/listings/10/reports",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"reason": "scam", "note": "Báo cáo lần 2"},
        )
        assert res.status_code == 409
        assert "đã báo cáo tin đăng này trước đó" in res.json()["error"]["message"]

    app.dependency_overrides.clear()


def test_report_success_and_validations(user_token, mock_user_reporter, mock_seller):
    """Báo cáo thành công và validation lý do / độ dài ghi chú."""
    mock_db = AsyncMock()
    mock_listing = make_mock_listing(listing_id=10, seller_id=mock_seller.user_id)
    created_report = make_mock_report(report_id=99, listing_id=10, reporter_id=mock_user_reporter.user_id)

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == mock_user_reporter.user_id:
            return mock_user_reporter
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.report_service import report_service
        mp.setattr(report_service.listing_repo, "find_by_id", AsyncMock(return_value=mock_listing))
        mp.setattr(report_service.report_repo, "find_by_reporter_and_listing", AsyncMock(return_value=None))
        mp.setattr(report_service.report_repo, "create_report", AsyncMock(return_value=created_report))

        # Lý do sai
        res_bad_reason = client.post(
            "/api/listings/10/reports",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"reason": "invalid_reason"},
        )
        assert res_bad_reason.status_code == 400

        # Ghi chú quá 200 ký tự
        res_long_note = client.post(
            "/api/listings/10/reports",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"reason": "scam", "note": "a" * 201},
        )
        assert res_long_note.status_code == 400

        # Thành công
        res_ok = client.post(
            "/api/listings/10/reports",
            headers={"Authorization": f"Bearer {user_token}"},
            json={"reason": "wrong_score", "note": "Món đồ trầy xước nhưng chấm 10 điểm"},
        )
        assert res_ok.status_code == 201
        assert res_ok.json()["status"] == "new"

    app.dependency_overrides.clear()
