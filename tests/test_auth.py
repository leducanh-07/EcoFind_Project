from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.models.user import User
from app.core.security import get_password_hash, decode_access_token

client = TestClient(app)


@pytest.fixture
def sample_user():
    """Tạo đối tượng User mẫu cho kiểm thử."""
    return User(
        user_id=1,
        full_name="Nguyễn Văn A",
        email="user@ecofind.vn",
        phone="0912345678",
        password_hash=get_password_hash("Password123@"),
        role="user",
        failed_attempts=0,
        locked_until=None,
    )


@pytest.fixture
def admin_user():
    """Tạo đối tượng Admin mẫu cho kiểm thử."""
    return User(
        user_id=2,
        full_name="Quản trị viên Hệ thống",
        email="admin@ecofind.vn",
        phone="0901234567",
        password_hash=get_password_hash("Admin123@"),
        role="admin",
        failed_attempts=0,
        locked_until=None,
    )


def test_login_success_user(sample_user):
    """Kiểm tra đăng nhập thành công với tài khoản User thường: trả 200 kèm JWT và role."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = sample_user
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.post(
            "/api/auth/login",
            json={"email": "user@ecofind.vn", "password": "Password123@"},
        )
        assert response.status_code == 200
        data = response.json()

        # Kiểm tra token và role
        assert "accessToken" in data
        assert data["tokenType"] == "bearer"
        assert data["role"] == "user"
        assert data["user"]["email"] == "user@ecofind.vn"

        # Giải mã và xác thực token JWT
        payload = decode_access_token(data["accessToken"])
        assert payload["sub"] == "1"
        assert payload["role"] == "user"
        assert "exp" in payload
    finally:
        app.dependency_overrides.clear()


def test_login_success_admin(admin_user):
    """Kiểm tra đăng nhập thành công với tài khoản Admin: trả role admin."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = admin_user
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.post(
            "/api/auth/login",
            json={"email": "admin@ecofind.vn", "password": "Admin123@"},
        )
        assert response.status_code == 200
        data = response.json()
        assert data["role"] == "admin"
    finally:
        app.dependency_overrides.clear()


def test_login_wrong_password(sample_user):
    """Sai mật khẩu trả 401 với thông báo chung 'Email hoặc mật khẩu không đúng'."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = sample_user
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.post(
            "/api/auth/login",
            json={"email": "user@ecofind.vn", "password": "WrongPassword@"},
        )
        assert response.status_code == 401
        data = response.json()
        assert "error" in data
        assert data["error"]["code"] == 401
        assert data["error"]["message"] == "Email hoặc mật khẩu không đúng"
        # Đã tăng failed_attempts
        assert sample_user.failed_attempts == 1
    finally:
        app.dependency_overrides.clear()


def test_login_non_existent_email():
    """Email không tồn tại trả 401 với thông báo chung (không lộ thông tin email)."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.post(
            "/api/auth/login",
            json={"email": "nonexistent@ecofind.vn", "password": "AnyPassword123@"},
        )
        assert response.status_code == 401
        data = response.json()
        assert data["error"]["code"] == 401
        assert data["error"]["message"] == "Email hoặc mật khẩu không đúng"
    finally:
        app.dependency_overrides.clear()


def test_login_account_lockout_after_five_failed_attempts(sample_user):
    """Nhập sai lần thứ 5 thì tài khoản bị khóa 15 phút và trả về 423 (TC-01, FR-02)."""
    mock_db = AsyncMock()
    sample_user.failed_attempts = 4  # Đã sai 4 lần trước đó
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = sample_user
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        # Lần sai thứ 5
        response = client.post(
            "/api/auth/login",
            json={"email": "user@ecofind.vn", "password": "WrongPassword@"},
        )
        assert response.status_code == 423
        data = response.json()
        assert data["error"]["code"] == 423
        assert "khóa 15 phút" in data["error"]["message"]
        assert sample_user.locked_until is not None
    finally:
        app.dependency_overrides.clear()


def test_login_already_locked_account(sample_user):
    """Tài khoản đang trong thời gian khóa thì kể cả nhập đúng cũng trả về 423."""
    mock_db = AsyncMock()
    sample_user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=10)
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = sample_user
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.post(
            "/api/auth/login",
            json={"email": "user@ecofind.vn", "password": "Password123@"},
        )
        assert response.status_code == 423
        data = response.json()
        assert data["error"]["code"] == 423
    finally:
        app.dependency_overrides.clear()


def test_login_invalid_input_validation():
    """Kiểm tra validation Pydantic (sai định dạng email) trả về 400 theo SDD 7.1."""
    response = client.post(
        "/api/auth/login",
        json={"email": "not-an-email", "password": "123"},
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == 400
    assert "fields" in data["error"]
    assert "email" in data["error"]["fields"]


def test_register_success():
    """Kiểm tra đăng ký tài khoản thành công: trả 201 kèm token và role user (FR-01)."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = None  # Không trùng email
    mock_db.execute.return_value = mock_result

    async def mock_refresh(user):
        user.user_id = 10

    mock_db.refresh.side_effect = mock_refresh

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.post(
            "/api/auth/register",
            json={
                "fullName": "Trần Thị B",
                "email": "user.b@ecofind.vn",
                "phone": "0987654321",
                "password": "Password123@",
            },
        )
        assert response.status_code == 201
        data = response.json()
        assert "accessToken" in data
        assert data["role"] == "user"
        assert data["user"]["email"] == "user.b@ecofind.vn"
        assert data["user"]["fullName"] == "Trần Thị B"
    finally:
        app.dependency_overrides.clear()


def test_register_duplicate_email(sample_user):
    """Đăng ký email đã tồn tại trả về 409 Conflict (FR-01, UC-01 E3)."""
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = sample_user  # Đã tồn tại
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        response = client.post(
            "/api/auth/register",
            json={
                "fullName": "Nguyễn Văn A",
                "email": "user@ecofind.vn",
                "phone": "0912345678",
                "password": "Password123@",
            },
        )
        assert response.status_code == 409
        data = response.json()
        assert data["error"]["code"] == 409
        assert "đã được đăng ký" in data["error"]["message"]
    finally:
        app.dependency_overrides.clear()


def test_register_short_password():
    """Đăng ký mật khẩu dưới 8 ký tự trả 400 kèm fields (FR-01, UC-01 E4)."""
    response = client.post(
        "/api/auth/register",
        json={
            "fullName": "Nguyễn Văn C",
            "email": "user.c@ecofind.vn",
            "phone": "0912345678",
            "password": "short",
        },
    )
    assert response.status_code == 400
    data = response.json()
    assert data["error"]["code"] == 400
    assert "fields" in data["error"]
    assert "password" in data["error"]["fields"]

