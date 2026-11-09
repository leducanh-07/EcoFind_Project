from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_db
from app.models.user import User
from app.core.security import get_password_hash

client = TestClient(app)


@pytest.fixture
def target_user():
    """Tạo đối tượng User để kiểm tra kịch bản khóa đăng nhập 15 phút."""
    return User(
        user_id=10,
        full_name="Người Dùng Kiểm Thử Khóa",
        email="lockout_test@ecofind.vn",
        phone="0987654321",
        password_hash=get_password_hash("CorrectPassword123@"),
        role="user",
        failed_attempts=0,
        locked_until=None,
    )


def test_tc01_lockout_after_five_failed_attempts(target_user):
    """
    Test Case TC-01 (SDD 8.2, FR-02, UC-01 E2):
    - Đăng nhập sai 5 lần liên tiếp: Lần 1-4 trả 401, lần 5 khóa 15 phút và trả 423.
    - Lần thứ 6 thử đăng nhập (kể cả đúng mật khẩu) vẫn nhận 423.
    """
    mock_db = AsyncMock()
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = target_user
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        # Lần sai 1 đến 4 -> Trả 401
        for attempt in range(1, 5):
            res = client.post(
                "/api/auth/login",
                json={"email": "lockout_test@ecofind.vn", "password": "WrongPassword!"},
            )
            assert res.status_code == 401
            assert res.json()["error"]["code"] == 401
            assert target_user.failed_attempts == attempt
            assert target_user.locked_until is None

        # Lần sai thứ 5 -> Kích hoạt khóa 15 phút, trả 423
        res_5 = client.post(
            "/api/auth/login",
            json={"email": "lockout_test@ecofind.vn", "password": "WrongPassword!"},
        )
        assert res_5.status_code == 423
        assert res_5.json()["error"]["code"] == 423
        assert "khóa 15 phút" in res_5.json()["error"]["message"]
        assert target_user.failed_attempts == 5
        assert target_user.locked_until is not None

        # Lần thứ 6: Đăng nhập bằng MẬT KHẨU ĐÚNG trong thời gian khóa -> Vẫn bị chặn 423
        res_6_correct = client.post(
            "/api/auth/login",
            json={"email": "lockout_test@ecofind.vn", "password": "CorrectPassword123@"},
        )
        assert res_6_correct.status_code == 423
        assert res_6_correct.json()["error"]["code"] == 423

        # Lần thứ 7: Đăng nhập bằng MẬT KHẨU SAI trong thời gian khóa -> Vẫn bị chặn 423
        res_7_wrong = client.post(
            "/api/auth/login",
            json={"email": "lockout_test@ecofind.vn", "password": "WrongAgain!"},
        )
        assert res_7_wrong.status_code == 423
    finally:
        app.dependency_overrides.clear()


def test_login_success_resets_failed_attempts(target_user):
    """Đăng nhập đúng sẽ đặt lại bộ đếm failed_attempts về 0."""
    mock_db = AsyncMock()
    target_user.failed_attempts = 3  # Từng nhập sai 3 lần trước đó
    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = target_user
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        res = client.post(
            "/api/auth/login",
            json={"email": "lockout_test@ecofind.vn", "password": "CorrectPassword123@"},
        )
        assert res.status_code == 200
        assert target_user.failed_attempts == 0
        assert target_user.locked_until is None
    finally:
        app.dependency_overrides.clear()


def test_lockout_expiration_allows_login(target_user):
    """Khi thời gian khóa 15 phút đã trôi qua, tài khoản tự động được mở khóa."""
    mock_db = AsyncMock()
    # Giả lập thời gian khóa đã hết hạn cách đây 1 phút
    target_user.failed_attempts = 5
    target_user.locked_until = datetime.now(timezone.utc) - timedelta(minutes=1)

    mock_result = MagicMock()
    mock_result.scalar_one_or_none.return_value = target_user
    mock_db.execute.return_value = mock_result

    async def override_get_db():
        yield mock_db

    app.dependency_overrides[get_db] = override_get_db
    try:
        # Nhập đúng mật khẩu sau khi hết hạn khóa -> Thành công 200 và reset trạng thái
        res = client.post(
            "/api/auth/login",
            json={"email": "lockout_test@ecofind.vn", "password": "CorrectPassword123@"},
        )
        assert res.status_code == 200
        assert target_user.failed_attempts == 0
        assert target_user.locked_until is None
    finally:
        app.dependency_overrides.clear()
