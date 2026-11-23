@echo off
chcp 65001 >nul
echo ==============================================================================
echo       EcoFind - Chợ đồ cũ Tích hợp Bản đồ & Đánh giá Tình trạng
echo       Khởi chạy trọn bộ hệ thống bằng 1 lệnh duy nhất (Task TE9C75A)
echo ==============================================================================

cd /d "%~dp0"

echo [1/4] Kiểm tra môi trường Python và seed dữ liệu demo TP.HCM...
python scripts/seed_demo_data.py
if errorlevel 1 (
    echo [CẢNH BÁO] Không thể seed dữ liệu tự động. Đang tiếp tục khởi động...
)

echo [2/4] Khởi động Backend API (FastAPI + Uvicorn) tại http://localhost:8000 ...
start "EcoFind Backend (FastAPI - Port 8000)" cmd /k "python -m uvicorn app.main:app --reload --port 8000"

echo [3/4] Khởi động Frontend (React + Vite) tại http://localhost:5173 ...
start "EcoFind Frontend (React/Vite - Port 5173)" cmd /k "cd frontend && npm run dev"

echo [4/4] Đang mở trình duyệt truy cập hệ thống...
timeout /t 3 >nul
start http://localhost:5173

echo ==============================================================================
echo Hệ thống EcoFind đã được khởi chạy thành công!
echo   - Giao diện người dùng: http://localhost:5173
echo   - Tài liệu API Swagger: http://localhost:8000/docs
echo   - Tài khoản Admin:      admin@ecofind.vn  /  Admin@123
echo   - Tài khoản Người bán:  seller@ecofind.vn /  Seller@123
echo   - Tài khoản Người mua:  buyer@ecofind.vn  /  Buyer@123
echo ==============================================================================
