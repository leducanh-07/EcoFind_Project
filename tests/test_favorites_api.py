"""
Unit and Integration Tests for Favorites API (TE9C751, UC-07, FR-11).
Acceptance Criteria:
- PUT /api/listings/{id}/favorite trả 204, gọi lặp lại không tạo thêm bản ghi (idempotent).
- DELETE /api/listings/{id}/favorite trả 204.
- GET /api/me/favorites trả danh sách tin đã lưu.
- Tin đã bán hoặc bị ẩn gắn nhãn 'Không còn bán' (E2).
- Yêu cầu xác thực: chưa đăng nhập trả 401.
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
from app.models.favorite import Favorite
from app.models.listing import Listing
from app.models.listing_photo import ListingPhoto
from app.models.user import User

client = TestClient(app)


@pytest.fixture
def mock_user():
    return User(
        user_id=1,
        full_name="Nguyễn Văn Người Dùng",
        email="user@ecofind.vn",
        phone="0911223344",
        password_hash="fakehash",
        role="user",
    )


@pytest.fixture
def user_token(mock_user):
    return create_access_token({
        "sub": str(mock_user.user_id),
        "email": mock_user.email,
        "role": mock_user.role,
    })


def make_mock_listing(listing_id=10, title="Bàn ghế gỗ cũ", status="selling", price="500000"):
    l = Listing(
        listing_id=listing_id,
        seller_id=2,
        category_id=1,
        title=title,
        description="Mô tả sản phẩm",
        price=Decimal(price),
        address="123 Lê Lợi, Q.1",
        lat=10.7769,
        lng=106.7009,
        score_appearance=Decimal("8.0"),
        score_function=Decimal("8.0"),
        score_accessories=Decimal("8.0"),
        total_score=Decimal("8.0"),
        status=status,
    )
    l.category = Category(category_id=1, name="Đồ nội thất")
    l.photos = [
        ListingPhoto(photo_id=1, listing_id=listing_id, url="https://img.ecofind.vn/table.jpg", sort_order=0)
    ]
    return l


def test_favorite_unauthenticated_returns_401():
    """Chưa đăng nhập gọi API yêu thích nhận 401 Unauthorized."""
    res_put = client.put("/api/listings/10/favorite")
    assert res_put.status_code == 401

    res_del = client.delete("/api/listings/10/favorite")
    assert res_del.status_code == 401

    res_get = client.get("/api/me/favorites")
    assert res_get.status_code == 401


def test_put_favorite_success_and_idempotent(mock_user, user_token):
    """PUT /api/listings/{id}/favorite trả 204, gọi lặp lại không tạo thêm bản ghi."""
    mock_db = AsyncMock()
    mock_listing = make_mock_listing(listing_id=10)

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == mock_user.user_id:
            return mock_user
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.favorite_service import favorite_service
        mp.setattr(favorite_service.listing_repo, "find_by_id", AsyncMock(return_value=mock_listing))
        mp.setattr(favorite_service.favorite_repo, "add_favorite", AsyncMock(return_value=True))

        # Lần 1
        res1 = client.put(
            "/api/listings/10/favorite",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert res1.status_code == 204

        # Lần 2 (idempotent)
        mp.setattr(favorite_service.favorite_repo, "add_favorite", AsyncMock(return_value=False))
        res2 = client.put(
            "/api/listings/10/favorite",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert res2.status_code == 204

    app.dependency_overrides.clear()


def test_put_favorite_nonexistent_listing_returns_404(mock_user, user_token):
    """Tin đăng không tồn tại khi lưu yêu thích trả 404 Not Found."""
    mock_db = AsyncMock()

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == mock_user.user_id:
            return mock_user
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.favorite_service import favorite_service
        mp.setattr(favorite_service.listing_repo, "find_by_id", AsyncMock(return_value=None))

        res = client.put(
            "/api/listings/999/favorite",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert res.status_code == 404
        assert "không tồn tại" in res.json()["error"]["message"].lower()

    app.dependency_overrides.clear()


def test_delete_favorite_returns_204(mock_user, user_token):
    """DELETE /api/listings/{id}/favorite trả 204 No Content."""
    mock_db = AsyncMock()

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == mock_user.user_id:
            return mock_user
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.favorite_service import favorite_service
        mp.setattr(favorite_service.favorite_repo, "remove_favorite", AsyncMock(return_value=True))

        res = client.delete(
            "/api/listings/10/favorite",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert res.status_code == 204

    app.dependency_overrides.clear()


def test_get_my_favorites_includes_status_label_e2(mock_user, user_token):
    """GET /api/me/favorites: tin đã bán hoặc bị ẩn gắn nhãn 'Không còn bán' (E2)."""
    mock_db = AsyncMock()
    now = datetime(2026, 11, 10, 12, 0, tzinfo=timezone.utc)

    l_selling = make_mock_listing(listing_id=1, title="Món đang bán", status="selling")
    fav1 = Favorite(user_id=mock_user.user_id, listing_id=1, created_at=now)

    l_sold = make_mock_listing(listing_id=2, title="Món đã bán", status="sold")
    fav2 = Favorite(user_id=mock_user.user_id, listing_id=2, created_at=now)

    l_hidden = make_mock_listing(listing_id=3, title="Món đã ẩn", status="hidden")
    fav3 = Favorite(user_id=mock_user.user_id, listing_id=3, created_at=now)

    mock_pairs = [
        (fav1, l_selling),
        (fav2, l_sold),
        (fav3, l_hidden),
    ]

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == mock_user.user_id:
            return mock_user
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.favorite_service import favorite_service
        mp.setattr(favorite_service.favorite_repo, "find_by_user", AsyncMock(return_value=mock_pairs))

        # Test endpoint /api/me/favorites
        res = client.get(
            "/api/me/favorites",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert res.status_code == 200
        items = res.json()
        assert len(items) == 3

        # Tin đang bán
        assert items[0]["id"] == 1
        assert items[0]["isAvailable"] is True
        assert items[0]["statusLabel"] is None

        # Tin đã bán
        assert items[1]["id"] == 2
        assert items[1]["isAvailable"] is False
        assert items[1]["statusLabel"] == "Không còn bán"

        # Tin đã ẩn
        assert items[2]["id"] == 3
        assert items[2]["isAvailable"] is False
        assert items[2]["statusLabel"] == "Không còn bán"

        # Test alias endpoint /api/favorites
        res_alias = client.get(
            "/api/favorites",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert res_alias.status_code == 200
        assert len(res_alias.json()) == 3

    app.dependency_overrides.clear()


def test_check_favorite_status(mock_user, user_token):
    """GET /api/listings/{id}/favorite kiểm tra tin đã lưu hay chưa."""
    mock_db = AsyncMock()

    async def override_get_db():
        yield mock_db

    async def mock_get_user(db, user_id):
        if user_id == mock_user.user_id:
            return mock_user
        return None

    app.dependency_overrides[get_db] = override_get_db
    user_repo.find_by_id = AsyncMock(side_effect=mock_get_user)

    with pytest.MonkeyPatch.context() as mp:
        from app.services.favorite_service import favorite_service
        mp.setattr(favorite_service.favorite_repo, "is_favorite", AsyncMock(return_value=True))

        res = client.get(
            "/api/listings/10/favorite",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert res.status_code == 200
        assert res.json()["isFavorite"] is True

        # Khi chưa đăng nhập -> trả isFavorite = false
        res_unauth = client.get("/api/listings/10/favorite")
        assert res_unauth.status_code == 200
        assert res_unauth.json()["isFavorite"] is False

    app.dependency_overrides.clear()
