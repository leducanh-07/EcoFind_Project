# ==============================================================================
# EcoFind - One-command Launcher (PowerShell)
# Khởi chạy trọn gói Backend + Frontend + Seed dữ liệu demo TP.HCM
# ==============================================================================

Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "      EcoFind - Chợ đồ cũ Tích hợp Bản đồ & Đánh giá Tình trạng" -ForegroundColor Green
Write-Host "      Khởi chạy trọn bộ hệ thống bằng 1 lệnh duy nhất" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green

Set-Location $PSScriptRoot

$VenvPython = if (Test-Path "$PSScriptRoot\venv\Scripts\python.exe") {
    "$PSScriptRoot\venv\Scripts\python.exe"
} elseif (Test-Path "$PSScriptRoot\.venv\Scripts\python.exe") {
    "$PSScriptRoot\.venv\Scripts\python.exe"
} else {
    "python"
}

Write-Host "`n[1/4] Kiểm tra môi trường Python và seed dữ liệu demo TP.HCM..." -ForegroundColor Cyan
& $VenvPython scripts/seed_demo_listings.py

Write-Host "`n[2/4] Khởi động Backend API (FastAPI + Uvicorn) tại http://localhost:8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot'; & '$VenvPython' -m uvicorn app.main:app --reload --port 8000"

Write-Host "`n[3/4] Khởi động Frontend (React + Vite) tại http://localhost:5173 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$PSScriptRoot\frontend'; npm run dev"

Write-Host "`n[4/4] Mở trình duyệt truy cập hệ thống..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

Write-Host "`n==============================================================================" -ForegroundColor Yellow
Write-Host " Hệ thống EcoFind đã được khởi chạy thành công!" -ForegroundColor Yellow
Write-Host "   - Giao diện người dùng: http://localhost:5173" -ForegroundColor White
Write-Host "   - Tài liệu API Swagger: http://localhost:8000/docs" -ForegroundColor White
Write-Host "`n 📋 TÀI KHOẢN TRẢI NGHIỆM DEMO:" -ForegroundColor White
Write-Host "   - Quản trị viên (Admin): admin@ecofind.vn   / Mật khẩu: Admin@123" -ForegroundColor White
Write-Host "   - Người bán công nghệ:  seller1@ecofind.vn / Mật khẩu: Demo@1234" -ForegroundColor White
Write-Host "   - Người bán gia dụng:   seller2@ecofind.vn / Mật khẩu: Demo@1234" -ForegroundColor White
Write-Host "   - Người mua sắm:        buyer@ecofind.vn   / Mật khẩu: Demo@1234" -ForegroundColor White
Write-Host "==============================================================================" -ForegroundColor Yellow
