import pytest
from fastapi import APIRouter
from fastapi.testclient import TestClient
from pydantic import BaseModel, Field
from app.main import app
from app.core.exceptions import (
    BadRequestException,
    UnauthorizedException,
    ForbiddenException,
    NotFoundException,
    ConflictException,
    LockedException,
)

# Tạo router giả lập để kiểm thử các loại lỗi (dùng tiền tố route_ thay vì test_ để pytest không nhầm)
mock_error_router = APIRouter(prefix="/api/mock-errors", tags=["Mock Errors"])


class MockItemSchema(BaseModel):
    name: str = Field(..., min_length=3)
    price: int = Field(..., ge=0)


@mock_error_router.post("/validation")
def route_validation(item: MockItemSchema):
    return item


@mock_error_router.get("/bad-request")
def route_bad_request():
    raise BadRequestException(message="Dữ liệu không hợp lệ", fields={"name": "Tên quá ngắn"})


@mock_error_router.get("/unauthorized")
def route_unauthorized():
    raise UnauthorizedException(message="Token đã hết hạn")


@mock_error_router.get("/forbidden")
def route_forbidden():
    raise ForbiddenException(message="Chỉ Admin mới có quyền truy cập")


@mock_error_router.get("/not-found")
def route_not_found():
    raise NotFoundException(message="Tin đăng không tồn tại")


@mock_error_router.get("/conflict")
def route_conflict():
    raise ConflictException(message="Email đã được sử dụng")


@mock_error_router.get("/locked")
def route_locked():
    raise LockedException(message="Tài khoản bị khóa 15 phút sau 5 lần sai")


@mock_error_router.get("/unhandled-error")
def route_unhandled_error():
    # Giả lập lỗi không lường trước (ZeroDivisionError)
    return 1 / 0


# Gắn router kiểm thử vào app
app.include_router(mock_error_router)

# raise_server_exceptions=False để testclient nhận response 500 từ global exception handler
client = TestClient(app, raise_server_exceptions=False)


def test_pydantic_validation_error_converted_to_400():
    """Tiêu chí 2: Lỗi Pydantic (mặc định 422) đổi thành 400 kèm fields và format chuẩn."""
    response = client.post("/api/mock-errors/validation", json={"name": "a", "price": -10})
    assert response.status_code == 400
    data = response.json()

    # Kiểm tra cấu trúc lỗi theo SDD 7.1
    assert "error" in data
    assert "detail" not in data
    assert data["error"]["code"] == 400
    assert "message" in data["error"]
    assert "fields" in data["error"]
    assert "name" in data["error"]["fields"]
    assert "price" in data["error"]["fields"]


def test_app_exceptions_mapping_sdd_7_1():
    """Tiêu chí 3: Ánh xạ đúng các mã 400, 401, 403, 404, 409, 423 theo SDD 7.1."""
    # 400
    res_400 = client.get("/api/mock-errors/bad-request")
    assert res_400.status_code == 400
    assert res_400.json()["error"]["code"] == 400
    assert res_400.json()["error"]["fields"] == {"name": "Tên quá ngắn"}

    # 401
    res_401 = client.get("/api/mock-errors/unauthorized")
    assert res_401.status_code == 401
    assert res_401.json()["error"]["code"] == 401
    assert res_401.json()["error"]["message"] == "Token đã hết hạn"

    # 403
    res_403 = client.get("/api/mock-errors/forbidden")
    assert res_403.status_code == 403
    assert res_403.json()["error"]["code"] == 403

    # 404
    res_404 = client.get("/api/mock-errors/not-found")
    assert res_404.status_code == 404
    assert res_404.json()["error"]["code"] == 404

    # 409
    res_409 = client.get("/api/mock-errors/conflict")
    assert res_409.status_code == 409
    assert res_409.json()["error"]["code"] == 409

    # 423
    res_423 = client.get("/api/mock-errors/locked")
    assert res_423.status_code == 423
    assert res_423.json()["error"]["code"] == 423


def test_standard_http_404_not_found():
    """Kiểm tra đường dẫn không tồn tại trả về chuẩn { error: { code, message, fields } }."""
    response = client.get("/api/non-existent-endpoint")
    assert response.status_code == 404
    data = response.json()
    assert "error" in data
    assert "detail" not in data
    assert data["error"]["code"] == 404


def test_unhandled_exception_returns_500_without_traceback():
    """Tiêu chí 4: Lỗi không lường trước trả 500 và không lộ traceback."""
    response = client.get("/api/mock-errors/unhandled-error")
    assert response.status_code == 500
    data = response.json()

    assert "error" in data
    assert "detail" not in data
    assert data["error"]["code"] == 500
    assert data["error"]["fields"] is None

    # Không lộ traceback hay file nội bộ
    response_text = response.text
    assert "Traceback" not in response_text
    assert "ZeroDivisionError" not in response_text
    assert "division by zero" not in response_text
