"""
Tests for new Admin Dashboard APIs:
  - GET /api/admin/stats
  - POST /api/admin/listings/{id}/hide & /restore
  - GET /api/admin/users
  - POST /api/admin/users/{id}/lock & /unlock
"""

from datetime import datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db
from app.core.security import create_access_token
from app.models.listing import Listing
from app.models.user import User

client = TestClient(app)


@pytest.fixture
def admin_account():
    return User(
        user_id=1,
        full_name="Quản trị viên Hệ thống",
        email="admin@ecofind.vn",
        phone="0900000001",
        password_hash="hash",
        role="admin",
        failed_attempts=0,
    )


@pytest.fixture
def member_account():
    return User(
        user_id=3,
        full_name="Nguyễn Văn Hùng",
        email="seller1@ecofind.vn",
        phone="0901234567",
        password_hash="hash",
        role="user",
        failed_attempts=0,
    )


def _auth_header(user: User):
    token = create_access_token({"sub": str(user.user_id), "role": user.role, "email": user.email})
    return {"Authorization": f"Bearer {token}"}


def test_admin_stats_requires_admin_role(member_account):
    mock_db = AsyncMock()

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with patch("app.core.dependencies.user_repo.find_by_id", AsyncMock(return_value=member_account)):
            res = client.get("/api/admin/stats", headers=_auth_header(member_account))
            assert res.status_code == 403
    finally:
        app.dependency_overrides.clear()


def test_admin_stats_success(admin_account):
    mock_db = AsyncMock()

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with (
            patch("app.core.dependencies.user_repo.find_by_id", AsyncMock(return_value=admin_account)),
            patch(
                "app.routers.admin.moderation_service.listing_repo.get_admin_listing_stats",
                AsyncMock(
                    return_value={
                        "status_counts": {"pending": 3, "selling": 28, "hidden": 2, "rejected": 1, "sold": 5},
                        "avg_selling_score": 8.4,
                        "categories": [{"category_id": 2, "name": "Đồ điện tử", "count": 12}],
                    }
                ),
            ),
            patch(
                "app.routers.admin.moderation_service.user_repo.get_admin_reports_and_user_counts",
                AsyncMock(
                    return_value={
                        "reports_new": 4,
                        "reports_resolved": 6,
                        "users_total": 5,
                        "users_locked": 1,
                    }
                ),
            ),
        ):
            res = client.get("/api/admin/stats", headers=_auth_header(admin_account))
            assert res.status_code == 200
            data = res.json()
            assert data["counts"]["pending"] == 3
            assert data["counts"]["selling"] == 28
            assert data["counts"]["hidden"] == 2
            assert data["counts"]["reportsNew"] == 4
            assert data["counts"]["usersLocked"] == 1
            assert data["avgSellingScore"] == 8.4
            assert len(data["categories"]) == 1
    finally:
        app.dependency_overrides.clear()


def test_admin_hide_and_restore_listing(admin_account):
    mock_db = AsyncMock()
    listing = Listing(
        listing_id=50,
        seller_id=3,
        category_id=2,
        title="Loa Bluetooth JBL",
        description="Âm thanh rõ",
        price=Decimal("900000"),
        address="Quận 1, TP.HCM",
        lat=10.77,
        lng=106.70,
        score_appearance=Decimal("8.0"),
        score_function=Decimal("9.0"),
        score_accessories=Decimal("8.0"),
        total_score=Decimal("8.4"),
        status="selling",
        hidden_by_admin=False,
    )

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with (
            patch("app.core.dependencies.user_repo.find_by_id", AsyncMock(return_value=admin_account)),
            patch(
                "app.routers.admin.moderation_service.listing_repo.find_by_id_with_relations",
                AsyncMock(return_value=listing),
            ),
        ):
            res_hide = client.post(
                "/api/admin/listings/50/hide",
                headers=_auth_header(admin_account),
                json={"reason": "Tin trùng lặp nhiều lần"},
            )
            assert res_hide.status_code == 200
            assert res_hide.json()["status"] == "hidden"
            assert listing.hidden_by_admin is True
            assert listing.reject_reason == "Tin trùng lặp nhiều lần"

            res_restore = client.post(
                "/api/admin/listings/50/restore",
                headers=_auth_header(admin_account),
            )
            assert res_restore.status_code == 200
            assert res_restore.json()["status"] == "selling"
            assert listing.hidden_by_admin is False
    finally:
        app.dependency_overrides.clear()


def test_admin_users_list_and_lock_unlock(admin_account, member_account):
    mock_db = AsyncMock()

    async def fake_update(db, u):
        return u

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with (
            patch("app.core.dependencies.user_repo.find_by_id", AsyncMock(return_value=admin_account)),
            patch(
                "app.routers.admin.user_service.user_repo.find_all_for_admin_management",
                AsyncMock(
                    return_value=[
                        {"user": member_account, "total": 5, "selling": 3, "hidden_by_admin": 1, "reports": 2}
                    ]
                ),
            ),
        ):
            res_users = client.get("/api/admin/users", headers=_auth_header(admin_account))
            assert res_users.status_code == 200
            users = res_users.json()
            assert len(users) == 1
            assert users[0]["fullName"] == "Nguyễn Văn Hùng"
            assert users[0]["listingsCount"] == 5
            assert users[0]["hiddenByAdminCount"] == 1
            assert users[0]["reportsReceivedCount"] == 2

        with (
            patch("app.core.dependencies.user_repo.find_by_id", AsyncMock(return_value=admin_account)),
            patch(
                "app.routers.admin.user_service.user_repo.find_by_id",
                AsyncMock(return_value=member_account),
            ),
            patch(
                "app.routers.admin.user_service.user_repo.update",
                AsyncMock(side_effect=fake_update),
            ),
        ):
            res_lock = client.post(
                "/api/admin/users/3/lock",
                headers=_auth_header(admin_account),
                json={"durationHours": 168},
            )
            assert res_lock.status_code == 200
            assert res_lock.json()["isLocked"] is True
            assert member_account.locked_until > datetime.now(timezone.utc) + timedelta(days=6)

            res_unlock = client.post(
                "/api/admin/users/3/unlock",
                headers=_auth_header(admin_account),
            )
            assert res_unlock.status_code == 200
            assert res_unlock.json()["isLocked"] is False
            assert member_account.locked_until is None
    finally:
        app.dependency_overrides.clear()


def test_admin_cannot_lock_admin_account(admin_account):
    mock_db = AsyncMock()

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with (
            patch("app.core.dependencies.user_repo.find_by_id", AsyncMock(return_value=admin_account)),
            patch(
                "app.routers.admin.user_service.user_repo.find_by_id",
                AsyncMock(return_value=admin_account),
            ),
        ):
            res = client.post(
                "/api/admin/users/1/lock",
                headers=_auth_header(admin_account),
                json={"durationHours": 24},
            )
            assert res.status_code == 403
    finally:
        app.dependency_overrides.clear()
