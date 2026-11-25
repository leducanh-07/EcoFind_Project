"""
Tests for Personal Profile (/api/me/profile), Password Change (/api/me/password),
and Public Seller Profile (/api/users/{user_id}/profile).
"""

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import AsyncMock, patch
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db
from app.core.security import create_access_token, get_password_hash, verify_password
from app.models.category import Category
from app.models.listing import Listing
from app.models.listing_photo import ListingPhoto
from app.models.user import User

client = TestClient(app)


@pytest.fixture
def sample_seller():
    return User(
        user_id=3,
        full_name="Nguyễn Văn Hùng",
        email="seller1@ecofind.vn",
        phone="0901234567",
        password_hash=get_password_hash("Demo@1234"),
        role="user",
        failed_attempts=0,
    )


@pytest.fixture
def sample_admin():
    return User(
        user_id=1,
        full_name="Quản trị viên Hệ thống",
        email="admin@ecofind.vn",
        phone="0900000001",
        password_hash=get_password_hash("Admin@123"),
        role="admin",
        failed_attempts=0,
    )


def _auth_header(user: User):
    token = create_access_token({"sub": str(user.user_id), "role": user.role, "email": user.email})
    return {"Authorization": f"Bearer {token}"}


def test_get_my_profile_requires_auth():
    response = client.get("/api/me/profile")
    assert response.status_code == 401


def test_get_my_profile_user_derives_specialty_and_featured_listings(sample_seller):
    mock_db = AsyncMock()
    listing = Listing(
        listing_id=21,
        seller_id=sample_seller.user_id,
        category_id=2,
        title="Bàn phím cơ AKKO",
        description="Còn rất mới",
        price=Decimal("650000"),
        address="Quận 1, TP.HCM",
        lat=10.77,
        lng=106.70,
        score_appearance=Decimal("8.5"),
        score_function=Decimal("9.0"),
        score_accessories=Decimal("9.5"),
        total_score=Decimal("8.9"),
        status="selling",
        hidden_by_admin=False,
        created_at=datetime.now(timezone.utc),
    )
    listing.category = Category(category_id=2, name="Đồ điện tử")
    listing.photos = [ListingPhoto(photo_id=1, listing_id=21, url="https://example.com/kb.jpg", sort_order=0)]

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with (
            patch("app.core.dependencies.user_repo.find_by_id", AsyncMock(return_value=sample_seller)),
            patch(
                "app.services.user_service.user_service.user_repo.get_listing_status_counts",
                AsyncMock(return_value={"selling": 4, "pending": 1, "sold": 2}),
            ),
            patch(
                "app.services.user_service.user_service.user_repo.get_favorites_count",
                AsyncMock(return_value=3),
            ),
            patch(
                "app.services.user_service.user_service.user_repo.get_reports_count",
                AsyncMock(return_value=0),
            ),
            patch(
                "app.services.user_service.user_service.user_repo.get_seller_top_categories",
                AsyncMock(return_value=[{"name": "Đồ điện tử", "count": 4}]),
            ),
            patch(
                "app.services.user_service.user_service.user_repo.find_public_seller_listings",
                AsyncMock(return_value=[listing]),
            ),
        ):
            response = client.get("/api/me/profile", headers=_auth_header(sample_seller))
            assert response.status_code == 200
            data = response.json()
            assert data["fullName"] == "Nguyễn Văn Hùng"
            assert data["activityRole"] == "Người bán · Chuyên Đồ điện tử"
            assert data["topCategories"] == [{"name": "Đồ điện tử", "count": 4}]
            assert data["adminStats"] is None
            assert len(data["featuredListings"]) == 1
    finally:
        app.dependency_overrides.clear()


def test_get_my_profile_admin_includes_system_stats(sample_admin):
    mock_db = AsyncMock()

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with (
            patch("app.core.dependencies.user_repo.find_by_id", AsyncMock(return_value=sample_admin)),
            patch(
                "app.services.user_service.user_service.user_repo.get_listing_status_counts",
                AsyncMock(return_value={}),
            ),
            patch(
                "app.services.user_service.user_service.user_repo.get_favorites_count",
                AsyncMock(return_value=0),
            ),
            patch(
                "app.services.user_service.user_service.user_repo.get_reports_count",
                AsyncMock(return_value=0),
            ),
            patch(
                "app.services.user_service.user_service.user_repo.get_seller_top_categories",
                AsyncMock(return_value=[]),
            ),
            patch(
                "app.services.user_service.user_service.user_repo.find_public_seller_listings",
                AsyncMock(return_value=[]),
            ),
            patch(
                "app.services.user_service.user_service.user_repo.get_admin_system_stats",
                AsyncMock(
                    return_value={
                        "pending_listings_count": 3,
                        "active_selling_count": 28,
                        "open_reports_count": 4,
                        "total_members_count": 5,
                    }
                ),
            ),
        ):
            response = client.get("/api/me/profile", headers=_auth_header(sample_admin))
            assert response.status_code == 200
            data = response.json()
            assert data["fullName"] == "Quản trị viên Hệ thống"
            assert data["adminStats"]["pendingListingsCount"] == 3
            assert data["adminStats"]["activeSellingCount"] == 28
            assert data["adminStats"]["openReportsCount"] == 4
            assert data["adminStats"]["totalMembersCount"] == 5
            assert data["featuredListings"] == []
    finally:
        app.dependency_overrides.clear()


def test_update_my_profile_success(sample_seller):
    mock_db = AsyncMock()

    async def override_get_db():
        yield mock_db

    async def fake_update(db, user):
        return user

    app.dependency_overrides[get_db] = override_get_db
    try:
        with (
            patch("app.core.dependencies.user_repo.find_by_id", AsyncMock(return_value=sample_seller)),
            patch("app.services.user_service.user_service.user_repo.update", AsyncMock(side_effect=fake_update)),
            patch(
                "app.services.user_service.user_service.user_repo.get_listing_status_counts",
                AsyncMock(return_value={"selling": 2}),
            ),
            patch(
                "app.services.user_service.user_service.user_repo.get_favorites_count",
                AsyncMock(return_value=1),
            ),
            patch(
                "app.services.user_service.user_service.user_repo.get_reports_count",
                AsyncMock(return_value=0),
            ),
            patch(
                "app.services.user_service.user_service.user_repo.get_seller_top_categories",
                AsyncMock(return_value=[]),
            ),
            patch(
                "app.services.user_service.user_service.user_repo.find_public_seller_listings",
                AsyncMock(return_value=[]),
            ),
        ):
            response = client.put(
                "/api/me/profile",
                headers=_auth_header(sample_seller),
                json={
                    "fullName": "Nguyễn Văn Hùng",
                    "phone": "0909 111 222",
                },
            )
            assert response.status_code == 200
            data = response.json()
            assert data["phone"] == "0909 111 222"
    finally:
        app.dependency_overrides.clear()


def test_change_password_wrong_current_returns_400(sample_admin):
    mock_db = AsyncMock()

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with patch("app.core.dependencies.user_repo.find_by_id", AsyncMock(return_value=sample_admin)):
            response = client.put(
                "/api/me/password",
                headers=_auth_header(sample_admin),
                json={
                    "currentPassword": "WrongPassword",
                    "newPassword": "NewPassword@123",
                    "confirmPassword": "NewPassword@123",
                },
            )
            assert response.status_code == 400
    finally:
        app.dependency_overrides.clear()


def test_change_password_success_updates_hash(sample_admin):
    mock_db = AsyncMock()

    async def override_get_db():
        yield mock_db

    async def fake_update(db, user):
        return user

    app.dependency_overrides[get_db] = override_get_db
    try:
        with (
            patch("app.core.dependencies.user_repo.find_by_id", AsyncMock(return_value=sample_admin)),
            patch("app.services.user_service.user_service.user_repo.update", AsyncMock(side_effect=fake_update)),
        ):
            response = client.put(
                "/api/me/password",
                headers=_auth_header(sample_admin),
                json={
                    "currentPassword": "Admin@123",
                    "newPassword": "AdminNew@456",
                    "confirmPassword": "AdminNew@456",
                },
            )
            assert response.status_code == 200
            assert response.json()["message"] == "Đổi mật khẩu thành công"
            assert verify_password("AdminNew@456", sample_admin.password_hash)
    finally:
        app.dependency_overrides.clear()


def test_get_public_seller_profile_success(sample_seller):
    mock_db = AsyncMock()
    listing = Listing(
        listing_id=21,
        seller_id=sample_seller.user_id,
        category_id=2,
        title="Bàn phím cơ AKKO",
        description="Còn rất mới",
        price=Decimal("650000"),
        address="Quận 1, TP.HCM",
        lat=10.77,
        lng=106.70,
        score_appearance=Decimal("8.5"),
        score_function=Decimal("9.0"),
        score_accessories=Decimal("9.5"),
        total_score=Decimal("8.9"),
        status="selling",
        hidden_by_admin=False,
        created_at=datetime.now(timezone.utc),
    )
    listing.category = Category(category_id=2, name="Đồ điện tử")
    listing.photos = [ListingPhoto(photo_id=1, listing_id=21, url="https://example.com/kb.jpg", sort_order=0)]

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with (
            patch("app.services.user_service.user_service.user_repo.find_by_id", AsyncMock(return_value=sample_seller)),
            patch(
                "app.services.user_service.user_service.user_repo.get_listing_status_counts",
                AsyncMock(return_value={"selling": 1, "sold": 1}),
            ),
            patch(
                "app.services.user_service.user_service.user_repo.get_favorites_count",
                AsyncMock(return_value=0),
            ),
            patch(
                "app.services.user_service.user_service.user_repo.get_seller_top_categories",
                AsyncMock(return_value=[{"name": "Đồ điện tử", "count": 1}]),
            ),
            patch(
                "app.services.user_service.user_service.user_repo.find_public_seller_listings",
                AsyncMock(return_value=[listing]),
            ),
        ):
            response = client.get("/api/users/3/profile")
            assert response.status_code == 200
            data = response.json()
            assert data["fullName"] == "Nguyễn Văn Hùng"
            assert data["activityRole"] == "Người bán · Chuyên Đồ điện tử"
            assert "email" not in data
            assert "phone" not in data
            assert data["stats"]["sellingCount"] == 1
            assert data["stats"]["soldCount"] == 1
            assert data["stats"]["avgScore"] == 8.9
            assert len(data["listings"]) == 1
    finally:
        app.dependency_overrides.clear()


def test_get_public_seller_profile_not_found():
    mock_db = AsyncMock()

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        with patch("app.services.user_service.user_service.user_repo.find_by_id", AsyncMock(return_value=None)):
            response = client.get("/api/users/9999/profile")
            assert response.status_code == 404
    finally:
        app.dependency_overrides.clear()
