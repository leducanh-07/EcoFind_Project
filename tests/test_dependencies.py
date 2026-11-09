from datetime import timedelta
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi import APIRouter, Depends
from fastapi.testclient import TestClient

from app.main import app
from app.core.database import get_db
from app.models.user import User
from app.core.security import create_access_token
from app.core.dependencies import (
    get_current_user,
    get_optional_user,
    require_role,
    check_listing_owner,
)

# Router kiểm thử cho các dependency xác thực & phân quyền
test_deps_router = APIRouter(prefix="/api/test-deps", tags=["Test Dependencies"])


@test_deps_router.get("/protected")
def protected_route(current_user: User = Depends(get_current_user)):
    return {"message": "success", "userId": current_user.user_id}


@test_deps_router.get("/admin-only")
def admin_only_route(current_user: User = Depends(require_role("admin"))):
    return {"message": "admin area", "role": current_user.role}


@test_deps_router.get("/optional")
def optional_route(current_user: User = Depends(get_optional_user)):
    if current_user:
        return {"loggedIn": True, "email": current_user.email}
    return {"loggedIn": False, "email": None}


@test_deps_router.get("/check-owner/{seller_id}")
def check_owner_route(seller_id: int, current_user: User = Depends(get_current_user)):
    check_listing_owner(current_user, seller_id)
    return {"message": "authorized"}


app.include_router(test_deps_router)
client = TestClient(app)


@pytest.fixture
def standard_user():
    return User(
        user_id=1,
        full_name="Người Dùng Thường",
        email="user@ecofind.vn",
        phone="0911111111",
        password_hash="hashed_pw",
        role="user",
        failed_attempts=0,
        locked_until=None,
    )


@pytest.fixture
def admin_user():
    return User(
        user_id=2,
        full_name="Quản Trị Viên",
        email="admin@ecofind.vn",
        phone="0922222222",
        password_hash="hashed_pw",
        role="admin",
        failed_attempts=0,
        locked_until=None,
    )


def test_get_current_user_missing_token():
    """Thiếu token xác thực -> trả 401."""
    res = client.get("/api/test-deps/protected")
    assert res.status_code == 401
    assert res.json()["error"]["code"] == 401
    assert "Chưa đăng nhập" in res.json()["error"]["message"]


def test_get_current_user_invalid_token():
    """Sai format hoặc chữ ký token -> trả 401."""
    res = client.get(
        "/api/test-deps/protected",
        headers={"Authorization": "Bearer malformed.token.value"},
    )
    assert res.status_code == 401
    assert res.json()["error"]["code"] == 401


def test_get_current_user_expired_token(standard_user):
    """Token hết hạn -> trả 401."""
    expired_token = create_access_token(
        data={"sub": str(standard_user.user_id), "email": standard_user.email, "role": standard_user.role},
        expires_delta=timedelta(minutes=-10),  # Hết hạn 10 phút trước
    )
    res = client.get(
        "/api/test-deps/protected",
        headers={"Authorization": f"Bearer {expired_token}"},
    )
    assert res.status_code == 401
    assert "hết hạn" in res.json()["error"]["message"]


def test_get_current_user_valid_token(standard_user):
    """Token hợp lệ -> trả thông tin user và HTTP 200."""
    valid_token = create_access_token(
        data={"sub": str(standard_user.user_id), "email": standard_user.email, "role": standard_user.role}
    )
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = standard_user
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        res = client.get(
            "/api/test-deps/protected",
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        assert res.status_code == 200
        assert res.json()["userId"] == standard_user.user_id
    finally:
        app.dependency_overrides.clear()


def test_require_role_admin_forbidden_for_user(standard_user):
    """Người dùng thông thường (role='user') gọi endpoint require_role('admin') -> trả 403 (TC-10)."""
    user_token = create_access_token(
        data={"sub": str(standard_user.user_id), "email": standard_user.email, "role": standard_user.role}
    )
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = standard_user
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        res = client.get(
            "/api/test-deps/admin-only",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert res.status_code == 403
        assert res.json()["error"]["code"] == 403
    finally:
        app.dependency_overrides.clear()


def test_require_role_admin_success(admin_user):
    """Admin đăng nhập gọi endpoint require_role('admin') -> thành công 200."""
    admin_token = create_access_token(
        data={"sub": str(admin_user.user_id), "email": admin_user.email, "role": admin_user.role}
    )
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = admin_user
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        res = client.get(
            "/api/test-deps/admin-only",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res.status_code == 200
        assert res.json()["role"] == "admin"
    finally:
        app.dependency_overrides.clear()


def test_get_optional_user_behavior(standard_user):
    """Endpoint Mọi người: có token thì đọc được user, không có token vẫn 200 với loggedIn=False."""
    # 1. Không có token
    res_no_token = client.get("/api/test-deps/optional")
    assert res_no_token.status_code == 200
    assert res_no_token.json()["loggedIn"] is False

    # 2. Token không hợp lệ -> Không văng lỗi 401, vẫn trả về 200 với loggedIn=False
    res_invalid_token = client.get(
        "/api/test-deps/optional",
        headers={"Authorization": "Bearer broken.jwt.token"},
    )
    assert res_invalid_token.status_code == 200
    assert res_invalid_token.json()["loggedIn"] is False

    # 3. Token hợp lệ -> Đọc được thông tin user
    valid_token = create_access_token(
        data={"sub": str(standard_user.user_id), "email": standard_user.email, "role": standard_user.role}
    )
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = standard_user
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        res_valid = client.get(
            "/api/test-deps/optional",
            headers={"Authorization": f"Bearer {valid_token}"},
        )
        assert res_valid.status_code == 200
        assert res_valid.json()["loggedIn"] is True
        assert res_valid.json()["email"] == standard_user.email
    finally:
        app.dependency_overrides.clear()


def test_check_listing_owner_logic(standard_user, admin_user):
    """Kiểm tra logic chủ tin (TC-08): chủ tin hoặc admin được phép, người khác bị 403."""
    user_token = create_access_token(
        data={"sub": str(standard_user.user_id), "email": standard_user.email, "role": standard_user.role}
    )
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = standard_user
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        # 1. User 1 truy cập tin của chính User 1 (seller_id = 1) -> Được phép
        res_owner = client.get(
            f"/api/test-deps/check-owner/{standard_user.user_id}",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert res_owner.status_code == 200

        # 2. User 1 truy cập tin của User 99 (seller_id = 99) -> 403 Forbidden (TC-08)
        res_other = client.get(
            "/api/test-deps/check-owner/99",
            headers={"Authorization": f"Bearer {user_token}"},
        )
        assert res_other.status_code == 403
        assert res_other.json()["error"]["code"] == 403
    finally:
        app.dependency_overrides.clear()

    # 3. Admin truy cập tin của người khác -> Được phép
    admin_token = create_access_token(
        data={"sub": str(admin_user.user_id), "email": admin_user.email, "role": admin_user.role}
    )
    mock_admin_result = MagicMock()
    mock_admin_result.scalar_one_or_none.return_value = admin_user
    mock_db.execute.return_value = mock_admin_result

    app.dependency_overrides[get_db] = override_get_db
    try:
        res_admin = client.get(
            "/api/test-deps/check-owner/99",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert res_admin.status_code == 200
    finally:
        app.dependency_overrides.clear()
