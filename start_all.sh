#!/bin/bash
# ==============================================================================
# EcoFind - One-command Launcher (Bash) - Task TE9C75A
# Khởi chạy trọn gói Backend + Frontend + Seed dữ liệu demo TP.HCM
# ==============================================================================

set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=============================================================================="
echo "      EcoFind - Chợ đồ cũ Tích hợp Bản đồ & Đánh giá Tình trạng"
echo "      Khởi chạy trọn bộ hệ thống bằng 1 lệnh duy nhất (Task TE9C75A)"
echo "=============================================================================="

echo "[1/4] Seed dữ liệu demo TP.HCM..."
python3 scripts/seed_demo_data.py || python scripts/seed_demo_data.py

echo "[2/4] Khởi động Backend API (FastAPI + Uvicorn) tại http://localhost:8000 ..."
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!

echo "[3/4] Khởi động Frontend (React + Vite) tại http://localhost:5173 ..."
(cd frontend && npm run dev -- --host 0.0.0.0) &
FRONTEND_PID=$!

trap "kill $BACKEND_PID $FRONTEND_PID 2>/dev/null" EXIT

echo "[4/4] Hệ thống đang hoạt động:"
echo "   - Frontend: http://localhost:5173"
echo "   - API Docs: http://localhost:8000/docs"
echo "Nhấn Ctrl+C để dừng toàn bộ hệ thống."

wait
