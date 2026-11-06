# EcoFind - SecondHand Map Backend

> Nền tảng Chợ đồ cũ Tích hợp Bản đồ & Đánh giá Tình trạng (EcoFind / SecondHand Map)
> Tuân thủ chuẩn IEEE Std 830 (SRS) & IEEE Std 1016 (SDD).

---

## 1. Kiến trúc dự án 3 tầng (3-tier Architecture)

Khung ứng dụng backend được tổ chức theo kiến trúc 3 tầng (SDD mục 2 & 4), tách biệt nhiệm vụ để các thành viên phát triển song song không xung đột:

- **Presentation Tier (Routers & Schemas)**:
  - `app/routers/`: Nhận HTTP request, kiểm tra xác thực JWT, gọi tầng Service tương ứng.
  - `app/schemas/`: Định nghĩa khuôn mẫu dữ liệu (Pydantic models) cho request/response, tự động chuyển đổi camelCase và kiểm tra tính hợp lệ dữ liệu vào.
- **Business Logic Tier (Services & Adapters)**:
  - `app/services/`: Thực thi toàn bộ quy tắc nghiệp vụ (BR-01 đến BR-05), điều phối luồng logic nghiệp vụ độc lập với giao thức HTTP.
  - `app/adapters/`: Lớp bao bọc giao tiếp với các dịch vụ bên ngoài (Nominatim geocoding, lưu trữ ảnh) theo nguyên tắc NFR-MNT-01.
- **Data Tier (Repositories & Core Database)**:
  - `app/repositories/`: Lớp chuyên trách truy xuất CSDL thông qua SQLAlchemy với truy vấn tham số hóa (chống SQL Injection theo NFR-SEC-04).
  - `app/core/`: Quản lý cấu hình tập trung (`config.py`) và kết nối CSDL (`database.py`).

```text
EcoFind/
├── app/
│   ├── __init__.py
│   ├── main.py                  # Khởi chạy ứng dụng FastAPI, cấu hình CORS & Swagger UI
│   ├── core/                    # Cấu hình hệ thống & kết nối DB
│   │   ├── __init__.py
│   │   ├── config.py            # Quản lý Settings & biến môi trường .env
│   │   └── database.py          # Cấu hình SQLAlchemy Engine & SessionLocal
│   ├── routers/                 # Tầng Controller / API Endpoints
│   │   ├── __init__.py
│   │   └── health.py            # Endpoint kiểm tra trạng thái (/api/health)
│   ├── services/                # Tầng Business Logic (Nghiệp vụ)
│   │   └── __init__.py
│   ├── repositories/            # Tầng Data Access (Truy vấn CSDL)
│   │   └── __init__.py
│   ├── adapters/                # Tầng Adapter tích hợp dịch vụ ngoài
│   │   └── __init__.py
│   └── schemas/                 # Pydantic Schemas (Request/Response validation)
│       ├── __init__.py
│       └── health.py            # Schema phản hồi của Health Check
├── scripts/
│   ├── create_tables.sql        # Script tạo 6 bảng CSDL (SDD 6.1)
│   ├── create_indexes.sql       # Script tạo 7 chỉ mục tối ưu hiệu năng (SDD 6.2)
│   ├── seed_data.sql            # Script seed danh mục & tài khoản Admin (SDD 6.1, UC-01)
│   └── seed.py                  # Script Python tự động chạy seed dữ liệu
├── tests/
│   ├── __init__.py
│   ├── test_health.py           # Unit test kiểm tra endpoint /api/health
│   ├── test_create_tables_sql.py# Test kiểm tra tính đúng đắn của create_tables.sql
│   └── test_seed_data_sql.py    # Test kiểm tra tính đúng đắn của seed_data.sql
├── .env.example                 # Mẫu cấu hình biến môi trường
├── .gitignore                   # Cấu hình tệp tin bỏ qua trong Git
├── README.md                    # Tài liệu hướng dẫn dự án
└── requirements.txt             # Danh sách thư viện phụ thuộc
```

---

## 2. Quy ước Git & Phân nhánh

- **Nhánh chính (Primary Branches):**
  - `main`: Nhánh production, chứa mã nguồn ổn định nhất.
  - `dev`: Nhánh tích hợp chính cho toàn bộ tính năng của Sprint 1.
- **Quy ước đặt tên nhánh tính năng:**
  - `feature/<task-code>-<ten-ngan>` (Ví dụ: `feature/te9c726-seed-data`)
- **Quy ước Commit Message:**
  - Định dạng: `<Task Code>: <Mô tả hành động>`
  - Ví dụ: `TE9C726: feat(db) seed categories and default admin account`

---

## 3. Hướng dẫn chạy và nghiệm thu trên máy Local

### 3.1. Tạo môi trường ảo (venv) & Cài đặt thư viện
Yêu cầu: Python 3.11+.

```powershell
# 1. Tạo môi trường ảo venv
python -m venv venv

# 2. Kích hoạt môi trường ảo (Windows PowerShell)
.\venv\Scripts\Activate.ps1
# (Trên Linux / macOS: source venv/bin/activate)

# 3. Cài đặt các package cần thiết
pip install -r requirements.txt
```

### 3.2. Cấu hình biến môi trường (.env)
```powershell
Copy-Item .env.example .env
```

### 3.3. Khởi tạo Cơ sở dữ liệu PostgreSQL & Seed dữ liệu
```powershell
# 1. Tạo CSDL ecofind_db trên PostgreSQL (nếu chưa tạo)
# CREATE DATABASE ecofind_db WITH ENCODING 'UTF8';

# 2. Tạo 6 bảng CSDL
psql -U postgres -d ecofind_db -f scripts/create_tables.sql

# 3. Tạo 7 chỉ mục tối ưu hiệu năng
psql -U postgres -d ecofind_db -f scripts/create_indexes.sql

# 4. Seed danh mục và tài khoản Admin
psql -U postgres -d ecofind_db -f scripts/seed_data.sql
# Hoặc chạy thông qua script Python:
python scripts/seed.py
```

### 3.4. Khởi chạy Server Backend
```powershell
uvicorn app.main:app --reload --port 8000
```

### 3.5. Tiêu chí nghiệm thu (Acceptance Criteria)
1. **Health Check:** Truy cập `http://localhost:8000/api/health` -> Trả về mã HTTP `200 OK` cùng định dạng JSON:
   ```json
   {
     "status": "ok",
     "appName": "EcoFind API",
     "environment": "development",
     "version": "1.0.0"
   }
   ```
2. **Swagger Documentation:** Truy cập `http://localhost:8000/docs` -> Hiển thị đầy đủ giao diện Swagger UI tương tác.
3. **Admin Account & Categories:**
   - Đã nạp tối thiểu 6 danh mục (Nội thất, Đồ điện tử, Sách & Văn phòng phẩm, Quần áo & Thời trang...).
   - Tài khoản Admin tạo sẵn: `admin@ecofind.vn` / mật khẩu `Admin@123` (được băm bcrypt).
