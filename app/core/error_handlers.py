import logging
from typing import Any, Dict
from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException
from app.core.exceptions import AppException

logger = logging.getLogger("app.error")


async def app_exception_handler(request: Request, exc: AppException) -> JSONResponse:
    """Xử lý các ngoại lệ nghiệp vụ do ứng dụng chủ động ném ra."""
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.code,
                "message": exc.message,
                "fields": exc.fields,
            }
        },
    )


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    """
    Bắt lỗi kiểm tra dữ liệu đầu vào của Pydantic.
    Chuyển đổi mã HTTP mặc định từ 422 thành 400 và chuẩn hóa danh sách fields.
    """
    fields: Dict[str, Any] = {}
    for err in exc.errors():
        loc = err.get("loc", [])
        # Lấy tên trường cuối cùng trong đường dẫn vị trí lỗi (bỏ 'body', 'query', 'path')
        field_name = str(loc[-1]) if loc else "general"
        msg = err.get("msg", "Dữ liệu không hợp lệ")

        # Bỏ tiền tố mặc định của Pydantic nếu có
        if msg.startswith("Value error, "):
            msg = msg[len("Value error, ") :]

        fields[field_name] = msg

    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error": {
                "code": status.HTTP_400_BAD_REQUEST,
                "message": "Dữ liệu yêu cầu không hợp lệ",
                "fields": fields,
            }
        },
    )


async def http_exception_handler(
    request: Request, exc: StarletteHTTPException
) -> JSONResponse:
    """Bắt các lỗi HTTP tiêu chuẩn (404, 405, 401, ...)."""
    # Nếu detail đã ở dạng dictionary chuẩn hoá
    if isinstance(exc.detail, dict) and "error" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)

    fields = getattr(exc, "fields", None)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error": {
                "code": exc.status_code,
                "message": str(exc.detail),
                "fields": fields,
            }
        },
    )


async def global_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    """
    Bắt mọi lỗi không lường trước (500).
    Ghi log traceback ở server nhưng tuyệt đối KHÔNG làm lộ traceback cho phía client.
    """
    logger.error(
        f"Lỗi không lường trước tại {request.method} {request.url.path}: {exc}",
        exc_info=True,
    )

    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "error": {
                "code": status.HTTP_500_INTERNAL_SERVER_ERROR,
                "message": "Đã xảy ra lỗi máy chủ nội bộ. Vui lòng thử lại sau.",
                "fields": None,
            }
        },
    )


def register_exception_handlers(app: FastAPI) -> None:
    """Đăng ký toàn bộ exception handler vào ứng dụng FastAPI."""
    app.add_exception_handler(AppException, app_exception_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    app.add_exception_handler(Exception, global_exception_handler)
