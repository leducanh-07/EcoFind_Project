# =============================================================================
# EcoFind Backend Dockerfile (FastAPI + Uvicorn)
# SDD mục 2 & 4, Task TE9C75A (DevOps / Triển khai)
# =============================================================================

FROM python:3.11-slim

# Thiết lập biến môi trường Python
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    APP_ENV=production \
    APP_PORT=8000

WORKDIR /app

# Cài đặt các gói hệ thống cần thiết cho PostgreSQL driver và xử lý ảnh
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Cài đặt dependencies Python
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Sao chép mã nguồn ứng dụng và thư mục dữ liệu
COPY app ./app
COPY scripts ./scripts
COPY uploads ./uploads

# Tạo thư mục uploads nếu chưa tồn tại
RUN mkdir -p uploads

# Khai báo cổng ứng dụng
EXPOSE 8000

# Kiểm tra tình trạng sức khỏe ứng dụng (Health check)
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
    CMD curl -f http://localhost:8000/api/health || exit 1

# Lệnh khởi chạy FastAPI thông qua ASGI server Uvicorn
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
