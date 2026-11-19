"""
Unit and Integration Tests for User Report Listing API (TE9C753, UC-08, E8, FR-12, TC-09).

Mô tả:
Là Người dùng, tôi muốn báo cáo tin sai điểm tình trạng, lừa đảo hoặc hàng cấm để Admin xử lý.

Tiêu chí chấp nhận:
- POST /api/listings/{id}/reports
- reason thuộc wrong_score, scam, prohibited, other
- note tối đa 200 ký tự (quá dài trả 400)
- Báo cáo lần 2 trả 409 (Conflict)
- Báo cáo tin của chính mình trả 403 (Forbidden, TC-09)
- Lưu trạng thái new
- Tin không tồn tại trả 404 (NotFound)
- Chưa đăng nhập trả 401 (Unauthorized)
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
    mock_db = AsyncMock()

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    yield
    user_repo.find_by_id = orig
    app.dependency_overrides.clear()


@pytest.fixture
def mock_reporter_user():
    return User(
        user_id=10,
        full_name="Người Dùng Báo Cáo",
        email="reporter@ecofind.vn",
        phone="0911222333",
        password_hash="fakehash",
        role="user",
    )


@pytest.fixture
def mock_seller_user():
    return User(
        user_id=20,
        full_name="Chủ Tin Đăng",
        email="seller@ecofind.vn",
        phone="0988777666",
        password_hash="fakehash",
        role="user",
    )


@pytest.fixture
def reporter_token(mock_reporter_user):
    return create_access_token({
        "sub": str(mock_reporter_user.user_id),
        "email": mock_reporter_user.email,
        "role": mock_reporter_user.role,
    })


@pytest.fixture
def seller_token(mock_seller_user):
    return create_access_token({
        "sub": str(mock_seller_user.user_id),
        "email": mock_seller_user.email,
        "role": mock_seller_user.role,
    })


def make_mock_listing(listing_id=100, seller_id=20, status="selling"):
    l = Listing(
        listing_id=listing_id,
        seller_id=seller_id,
        category_id=1,
        title="Bàn phím cơ cũ",
        description="Bàn phím cơ còn mới 95%",
        price=Decimal("500000"),
        address="456 Nguyễn Thị Minh Khai, Q.3",
        lat=10.7700,
        lng=106.6900,
        score_appearance=Decimal("9.0"),
        score_function=Decimal("9.0"),
        score_accessories=Decimal("8.0"),
        total_score=Decimal("8.8"),
        status=status,
        hidden_by_admin=False,
    )
    l.photos = []
    l.seller = User(user_id=seller_id, full_name="Chủ Tin Đăng", email="seller@ecofind.vn")
    return l


def make_mock_report(report_id=1, listing_id=100, reporter_id=10, reason="wrong_score", note=None, status="new"):
    return Report(
        report_id=report_id,
        listing_id=listing_id,
        reporter_id=reporter_id,
        reason=reason,
        note=note,
        status=status,
        created_at=datetime.now(timezone.utc),
    )


# -----------------------------------------------------------------------------
# 1. Kiểm tra xác thực (401 Unauthorized)
# -----------------------------------------------------------------------------
def test_report_listing_unauthorized_401():
    """Khách chưa đăng nhập khi gọi POST /api/listings/{id}/reports phải nhận 401."""
    res = client.post(
        "/api/listings/100/reports",
        json={"reason": "scam", "note": "Nghi ngờ lừa đảo"},
    )
    assert res.status_code == 401
    assert "chưa đăng nhập" in res.json()["error"]["message"].lower() or "token" in res.json()["error"]["message"].lower()


# -----------------------------------------------------------------------------
# 2. Kiểm tra tin không tồn tại (404 Not Found)
# -----------------------------------------------------------------------------
def test_report_listing_not_found_404(reporter_token, mock_reporter_user):
    """Báo cáo tin không tồn tại trong hệ thống phải nhận 404 Not Found."""
    async def mock_get_user(db, user_id):
        if user_id == mock_reporter_user.user_id:
            return mock_reporter_user
        return None

    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.report_service import report_service
        mp.setattr(report_service.listing_repo, "find_by_id", AsyncMock(return_value=None))

        res = client.post(
            "/api/listings/9999/reports",
            headers={"Authorization": f"Bearer {reporter_token}"},
            json={"reason": "scam", "note": "Tin giả"},
        )
        assert res.status_code == 404
        assert "không tồn tại" in res.json()["error"]["message"].lower()


# -----------------------------------------------------------------------------
# 3. Kiểm tra báo cáo tin của chính mình (403 Forbidden - TC-09)
# -----------------------------------------------------------------------------
def test_report_own_listing_forbidden_403_tc09(seller_token, mock_seller_user):
    """TC-09: Báo cáo tin của chính mình trả 403 Forbidden."""
    mock_listing = make_mock_listing(listing_id=100, seller_id=mock_seller_user.user_id)

    async def mock_get_user(db, user_id):
        if user_id == mock_seller_user.user_id:
            return mock_seller_user
        return None

    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.report_service import report_service
        mp.setattr(report_service.listing_repo, "find_by_id", AsyncMock(return_value=mock_listing))

        res = client.post(
            "/api/listings/100/reports",
            headers={"Authorization": f"Bearer {seller_token}"},
            json={"reason": "wrong_score", "note": "Tự báo cáo đồ của mình"},
        )
        assert res.status_code == 403
        assert "không thể tự báo cáo" in res.json()["error"]["message"].lower()


# -----------------------------------------------------------------------------
# 4. Kiểm tra báo cáo lần 2 cùng một tin (409 Conflict - TC-09)
# -----------------------------------------------------------------------------
def test_report_duplicate_conflict_409_tc09(reporter_token, mock_reporter_user, mock_seller_user):
    """TC-09: Báo cáo cùng một tin lần 2 trả 409 Conflict."""
    mock_listing = make_mock_listing(listing_id=100, seller_id=mock_seller_user.user_id)
    existing_report = make_mock_report(report_id=1, listing_id=100, reporter_id=mock_reporter_user.user_id)

    async def mock_get_user(db, user_id):
        if user_id == mock_reporter_user.user_id:
            return mock_reporter_user
        return None

    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.report_service import report_service
        mp.setattr(report_service.listing_repo, "find_by_id", AsyncMock(return_value=mock_listing))
        mp.setattr(report_service.report_repo, "find_by_reporter_and_listing", AsyncMock(return_value=existing_report))

        res = client.post(
            "/api/listings/100/reports",
            headers={"Authorization": f"Bearer {reporter_token}"},
            json={"reason": "scam", "note": "Báo cáo lần thứ hai"},
        )
        assert res.status_code == 409
        assert "đã báo cáo tin đăng này trước đó" in res.json()["error"]["message"].lower()


# -----------------------------------------------------------------------------
# 5. Kiểm tra validation lý do báo cáo (reason: 400 Bad Request)
# -----------------------------------------------------------------------------
@pytest.mark.parametrize("invalid_reason", ["", "hack", "spam", "random_string", "123"])
def test_report_invalid_reason_400(reporter_token, mock_reporter_user, mock_seller_user, invalid_reason):
    """Lý do không thuộc {wrong_score, scam, prohibited, other} phải trả 400 Bad Request."""
    mock_listing = make_mock_listing(listing_id=100, seller_id=mock_seller_user.user_id)

    async def mock_get_user(db, user_id):
        if user_id == mock_reporter_user.user_id:
            return mock_reporter_user
        return None

    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.report_service import report_service
        mp.setattr(report_service.listing_repo, "find_by_id", AsyncMock(return_value=mock_listing))

        res = client.post(
            "/api/listings/100/reports",
            headers={"Authorization": f"Bearer {reporter_token}"},
            json={"reason": invalid_reason, "note": "Lý do sai"},
        )
        assert res.status_code == 400
        assert "không hợp lệ" in res.json()["error"]["message"].lower() or "reason" in str(res.json()["error"]).lower()


def test_report_missing_reason_400(reporter_token, mock_reporter_user):
    """Thiếu trường reason bắt buộc phải trả 400 Bad Request."""
    async def mock_get_user(db, user_id):
        if user_id == mock_reporter_user.user_id:
            return mock_reporter_user
        return None

    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    res = client.post(
        "/api/listings/100/reports",
        headers={"Authorization": f"Bearer {reporter_token}"},
        json={"note": "Chỉ có ghi chú mà không có lý do"},
    )
    assert res.status_code == 400


# -----------------------------------------------------------------------------
# 6. Kiểm tra validation độ dài ghi chú (note: tối đa 200 ký tự - 400 Bad Request)
# -----------------------------------------------------------------------------
def test_report_note_too_long_400(reporter_token, mock_reporter_user, mock_seller_user):
    """Ghi chú dài quá 200 ký tự phải trả 400 Bad Request."""
    mock_listing = make_mock_listing(listing_id=100, seller_id=mock_seller_user.user_id)

    async def mock_get_user(db, user_id):
        if user_id == mock_reporter_user.user_id:
            return mock_reporter_user
        return None

    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.report_service import report_service
        mp.setattr(report_service.listing_repo, "find_by_id", AsyncMock(return_value=mock_listing))

        # Chuỗi dài 201 ký tự
        long_note = "A" * 201
        res = client.post(
            "/api/listings/100/reports",
            headers={"Authorization": f"Bearer {reporter_token}"},
            json={"reason": "scam", "note": long_note},
        )
        assert res.status_code == 400
        assert "200" in res.json()["error"]["message"] or "200" in str(res.json()["error"])


# -----------------------------------------------------------------------------
# 7. Kiểm tra báo cáo thành công với 4 lý do hợp lệ & lưu trạng thái new (201 Created)
# -----------------------------------------------------------------------------
@pytest.mark.parametrize("valid_reason", ["wrong_score", "scam", "prohibited", "other"])
def test_report_success_all_valid_reasons_201(
    reporter_token,
    mock_reporter_user,
    mock_seller_user,
    valid_reason,
):
    """Báo cáo thành công với 4 lý do: wrong_score, scam, prohibited, other; trạng thái lưu là new."""
    mock_listing = make_mock_listing(listing_id=100, seller_id=mock_seller_user.user_id)
    created_report = make_mock_report(
        report_id=50,
        listing_id=100,
        reporter_id=mock_reporter_user.user_id,
        reason=valid_reason,
        note="Ghi chú phản ánh",
        status="new",
    )

    async def mock_get_user(db, user_id):
        if user_id == mock_reporter_user.user_id:
            return mock_reporter_user
        return None

    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.report_service import report_service
        mp.setattr(report_service.listing_repo, "find_by_id", AsyncMock(return_value=mock_listing))
        mp.setattr(report_service.report_repo, "find_by_reporter_and_listing", AsyncMock(return_value=None))
        mp.setattr(report_service.report_repo, "create_report", AsyncMock(return_value=created_report))

        res = client.post(
            "/api/listings/100/reports",
            headers={"Authorization": f"Bearer {reporter_token}"},
            json={"reason": valid_reason, "note": "Ghi chú phản ánh"},
        )
        assert res.status_code == 201
        data = res.json()
        assert data.get("reportId") == 50 or data.get("report_id") == 50
        assert data.get("listingId") == 100 or data.get("listing_id") == 100
        assert data["status"] == "new"
        assert "thành công" in data["message"].lower()


def test_report_success_without_note_or_exact_200_chars(
    reporter_token,
    mock_reporter_user,
    mock_seller_user,
):
    """Báo cáo thành công khi note là None hoặc đúng 200 ký tự."""
    mock_listing = make_mock_listing(listing_id=100, seller_id=mock_seller_user.user_id)

    async def mock_get_user(db, user_id):
        if user_id == mock_reporter_user.user_id:
            return mock_reporter_user
        return None

    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.report_service import report_service
        mp.setattr(report_service.listing_repo, "find_by_id", AsyncMock(return_value=mock_listing))
        mp.setattr(report_service.report_repo, "find_by_reporter_and_listing", AsyncMock(return_value=None))

        # 1. Không gửi note
        created_report_1 = make_mock_report(report_id=51, listing_id=100, reporter_id=mock_reporter_user.user_id, note=None)
        mp.setattr(report_service.report_repo, "create_report", AsyncMock(return_value=created_report_1))

        res1 = client.post(
            "/api/listings/100/reports",
            headers={"Authorization": f"Bearer {reporter_token}"},
            json={"reason": "wrong_score"},
        )
        assert res1.status_code == 201
        assert res1.json()["status"] == "new"

        # 2. Gửi note đúng 200 ký tự (biên trên hợp lệ)
        note_200 = "N" * 200
        created_report_2 = make_mock_report(report_id=52, listing_id=100, reporter_id=mock_reporter_user.user_id, note=note_200)
        mp.setattr(report_service.report_repo, "create_report", AsyncMock(return_value=created_report_2))

        res2 = client.post(
            "/api/listings/100/reports",
            headers={"Authorization": f"Bearer {reporter_token}"},
            json={"reason": "prohibited", "note": note_200},
        )
        assert res2.status_code == 201
        assert res2.json()["status"] == "new"
