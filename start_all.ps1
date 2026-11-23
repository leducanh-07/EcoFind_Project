# ==============================================================================
# EcoFind - One-command Launcher (PowerShell) - Task TE9C75A
# Khởi chạy trọn gói Backend + Frontend + Seed dữ liệu demo TP.HCM
# ==============================================================================

Write-Host "==============================================================================" -ForegroundColor Green
Write-Host "      EcoFind - Chợ đồ cũ Tích hợp Bản đồ & Đánh giá Tình trạng" -ForegroundColor Green
Write-Host "      Khởi chạy trọn bộ hệ thống bằng 1 lệnh duy nhất (Task TE9C75A)" -ForegroundColor Green
Write-Host "==============================================================================" -ForegroundColor Green

Set-Location $PSScriptRoot

Write-Host "`n[1/4] Seed dữ liệu demo TP.HCM..." -ForegroundColor Cyan
python scripts/seed_demo_data.py

Write-Host "`n[2/4] Khởi động Backend API (FastAPI + Uvicorn) tại http://localhost:8000 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "python -m uvicorn app.main:app --reload --port 8000"

Write-Host "`n[3/4] Khởi động Frontend (React + Vite) tại http://localhost:5173 ..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location frontend; npm run dev"

Write-Host "`n[4/4] Mở trình duyệt truy cập hệ thống..." -ForegroundColor Cyan
Start-Sleep -Seconds 3
Start-Process "http://localhost:5173"

Write-Host "`n==============================================================================" -ForegroundColor Yellow
Write-Host " Hệ thống EcoFind đã được khởi chạy thành công!" -ForegroundColor Yellow
Write-Host "   - Giao diện người dùng: http://localhost:5173" -ForegroundColor White
Write-Host "   - Tài liệu API Swagger: http://localhost:8000/docs" -ForegroundColor White
Write-Host "   - Tài khoản Admin:      admin@ecofind.vn  /  Admin@123" -ForegroundColor White
Write-Host "   - Tài khoản Người bán:  seller@ecofind.vn /  Seller@123" -ForegroundColor White
Write-Host "   - Tài khoản Người mua:  buyer@ecofind.vn  /  Buyer@123" -ForegroundColor White
Write-Host "==============================================================================" -ForegroundColor Yellow
