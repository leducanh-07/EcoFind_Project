@echo off
chcp 65001 >nul
echo ==============================================================================
echo       EcoFind - Chợ đồ cũ Tích hợp Bản đồ ^& Đánh giá Tình trạng
echo       Khởi chạy trọn bộ hệ thống bằng 1 lệnh duy nhất
echo ==============================================================================

cd /d "%~dp0"

:: Tự động kích hoạt môi trường ảo Python (venv hoặc .venv)
if exist "venv\Scripts\activate.bat" (
    call "venv\Scripts\activate.bat"
) else if exist ".venv\Scripts\activate.bat" (
    call ".venv\Scripts\activate.bat"
)

echo.
echo [1/4] Kiểm tra môi trường Python và seed dữ liệu demo TP.HCM...
python scripts/seed_demo_listings.py
if errorlevel 1 (
    echo [CẢNH BÁO] Không thể seed dữ liệu tự động. Đang tiếp tục khởi động...
)

echo.
echo [2/4] Khởi động Backend API (FastAPI + Uvicorn) tại http://localhost:8000 ...
start "EcoFind Backend (FastAPI - Port 8000)" cmd /k "cd /d ""%~dp0"" && (if exist venv\Scripts\activate.bat call venv\Scripts\activate.bat) & (if exist .venv\Scripts\activate.bat call .venv\Scripts\activate.bat) & python -m uvicorn app.main:app --reload --port 8000"

echo.
echo [3/4] Khởi động Frontend (React + Vite) tại http://localhost:5173 ...
start "EcoFind Frontend (React/Vite - Port 5173)" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo.
echo [4/4] Đang mở trình duyệt truy cập hệ thống...
timeout /t 3 >nul
start http://localhost:5173

echo.
echo ==============================================================================
echo Hệ thống EcoFind đã được khởi chạy thành công!
echo   - Giao diện người dùng: http://localhost:5173
echo   - Tài liệu API Swagger: http://localhost:8000/docs
echo.
echo 📋 TÀI KHOẢN TRẢI NGHIỆM DEMO:
echo   - Quản trị viên (Admin): admin@ecofind.vn   / Mật khẩu: Admin@123
echo   - Người bán công nghệ:  seller1@ecofind.vn / Mật khẩu: Demo@1234
echo   - Người bán gia dụng:   seller2@ecofind.vn / Mật khẩu: Demo@1234
echo   - Người mua sắm:        buyer@ecofind.vn   / Mật khẩu: Demo@1234
echo ==============================================================================
