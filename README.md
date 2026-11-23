# EcoFind - Nền tảng Mua bán Đồ cũ Tích hợp Bản đồ & Đánh giá Tình trạng

> **Dự án Lab Rk1 / Kỹ nghệ Phần mềm**  
> Tuân thủ đặc tả yêu cầu IEEE Std 830 (SRS) và tài liệu thiết kế kiến trúc IEEE Std 1016 (SDD).

---

## 1. Giới thiệu tổng quan (Project Overview)

**EcoFind** là nền tảng thương mại điện tử kết nối người mua và người bán đồ cũ (SecondHand), tập trung vào trải nghiệm trực quan trên bản đồ địa lý khu vực TP.HCM. Điểm đột phá của hệ thống là **Cơ chế đánh giá tình trạng minh bạch (Condition Score)** dựa trên 3 tiêu chí cốt lõi (Ngoại quan, Công năng, Phụ kiện), kết hợp quy trình kiểm duyệt nghiêm ngặt của Quản trị viên (Admin) và tính năng tự điều chỉnh trạng thái thông minh của Người bán.

### Các phân hệ chính (Modules):
- 🗺️ **Bản đồ tương tác (Interactive Map - Leaflet / OSM)**: Tìm kiếm tin đăng theo khung nhìn (bounding box), bán kính (1–20 km theo Haversine), quận/huyện, từ khóa và bộ lọc giá / điểm tình trạng. Marker hiển thị huy hiệu điểm tình trạng trực quan.
- 🔐 **Xác thực & Phân quyền (Authentication & Authorization)**: Đăng ký, đăng nhập JWT access token, kiểm tra vai trò (Admin / User), bảo mật mật khẩu với thuật toán Bcrypt.
- 📝 **Đăng tin & Chấm điểm (Post Listing & Condition Scoring - BR-01/BR-02)**: Đăng tin kèm tải nhiều ảnh, tự động tính điểm trung bình có trọng số, cảnh báo quy tắc duyệt lại khi sửa điểm/ảnh.
- 🛡️ **Kiểm duyệt tin đăng (Admin Moderation - UC-09, BR-01, FR-14)**: Admin duyệt tin (có thể hạ điểm thành phần nếu người bán tự chấm quá cao), từ chối tin kèm lý do vi phạm chi tiết, ngăn chặn duyệt trùng lặp (HTTP 409 Conflict).
- 📦 **Quản lý tin của tôi (My Listings Management - UC-06, FR-10)**: Phân loại theo 5 trạng thái (`selling`, `pending`, `hidden`, `sold`, `rejected`). Chuyển đổi trạng thái linh hoạt, hỗ trợ sửa tin đăng và nộp duyệt lại tin bị từ chối.
- 🚨 **Báo cáo tin vi phạm (Report Listing - UC-08, FR-12)**: Báo cáo với 4 lý do chuẩn hóa (`wrong_score`, `scam`, `prohibited`, `other`), kèm ghi chú tối đa 200 ký tự và ngăn chặn báo cáo tin của chính mình / báo cáo trùng lặp.
- ⭐ **Tin lưu yêu thích (Favorites)**: Lưu và quản lý danh sách tin quan tâm nhanh chóng.

---

## 2. Kiến trúc hệ thống (System Architecture)

Hệ thống được xây dựng theo **Kiến trúc 3 tầng (3-tier Architecture)** tách biệt rõ ràng:

```text
EcoFind_Project/
├── app/                         # Backend (FastAPI + SQLAlchemy + Uvicorn)
│   ├── main.py                  # Khởi chạy FastAPI, middleware CORS & Exception handlers
│   ├── core/                    # Cấu hình tập trung (config, database, security, geo, exceptions)
│   ├── models/                  # SQLAlchemy ORM Models (User, Listing, Category, Photo, Favorite, Report)
│   ├── schemas/                 # Pydantic Schemas (Validation, camelCase serialization)
│   ├── routers/                 # API Endpoints (auth, listings, categories, admin, favorites, reports, me)
│   ├── services/                # Business Logic Tier (Quy tắc BR-01 -> BR-05, moderation, score calc)
│   ├── repositories/            # Data Access Tier (SQLAlchemy async queries, parameterized)
│   └── adapters/                # Tích hợp dịch vụ ngoài (Storage ảnh, Geocoding)
├── frontend/                    # Frontend (React 18 + Vite + Tailwind CSS + Lucide Icons + Leaflet)
│   ├── src/
│   │   ├── api/                 # Axios HTTP client cấu hình JWT interceptor
│   │   ├── components/          # UI Components (Navbar, MapView, ListingCard, AuthModal, ReportDialog...)
│   │   ├── context/             # React Contexts (AuthContext, NotificationContext)
│   │   ├── pages/               # Trang ứng dụng (HomePage, PostListingPage, MyListingsPage, AdminModeration...)
│   │   └── index.css            # Tailwind CSS styling & custom animations
│   ├── Dockerfile               # Multi-stage Docker build cho Frontend
│   ├── nginx.conf               # Nginx reverse proxy + Gzip + HTTPS security headers
│   └── package.json
├── docs/                        # Tài liệu dự án & Báo cáo kiểm thử hiệu năng
│   ├── PERFORMANCE_REPORT_10K.md# Báo cáo đo lường hiệu năng với 10.000 tin mẫu (TC-02, TC-03)
│   └── benchmark_results.json   # Dữ liệu đo lường chi tiết 10 lần chạy
├── scripts/                     # Scripts hỗ trợ CSDL, Seed Demo & Benchmark
│   ├── seed_demo_data.py        # Seed dữ liệu demo TP.HCM (7 danh mục, 3 tài khoản, 20+ tin mẫu đa dạng)
│   ├── generate_10k_listings.py # Script sinh 10.000 tin mẫu tại 20 quận/huyện TP.HCM
│   ├── benchmark_performance.py # Script đo lường hiệu năng tự động TC-02 & TC-03
│   ├── add_pg_trgm.sql          # Script cấu hình chỉ mục PostgreSQL Trigram (pg_trgm)
│   ├── create_tables.sql        # DDL tạo cấu trúc 6 bảng CSDL
│   ├── create_indexes.sql       # Chỉ mục tối ưu hóa hiệu năng (idx_listings_map, idx_listings_seller...)
│   └── seed_data.sql            # Dữ liệu khởi tạo (Danh mục & Admin)
├── tests/                       # Bộ kiểm thử tự động Backend (198 tests gồm test luồng E2E)
├── Dockerfile                   # Dockerfile cho Backend FastAPI
├── docker-compose.yml           # Khởi chạy trọn gói: Postgres 15 + Backend + Frontend
├── .env.docker                  # Biến môi trường mẫu cho Docker
├── start_all.bat                # Khởi chạy trọn bộ bằng 1 click trên Windows (Batch)
├── start_all.ps1                # Khởi chạy trọn bộ bằng 1 lệnh trên Windows (PowerShell)
├── start_all.sh                 # Khởi chạy trọn bộ bằng 1 lệnh trên Linux / macOS (Bash)
├── requirements.txt             # Thư viện Backend Python
└── README.md                    # Tài liệu hướng dẫn sử dụng & nghiệm thu
```

---

## 3. Hướng dẫn chạy hệ thống (Deployment & Quickstart)

### 3.1. Khởi chạy bằng 1 lệnh duy nhất (Khuyên dùng cho Người hướng dẫn / Chấm bài)

Hệ thống đã chuẩn bị sẵn kịch bản 1 lệnh giúp khởi chạy toàn bộ Backend (cổng 8000), Frontend (cổng 5173), tự động nạp dữ liệu demo TP.HCM và mở sẵn trình duyệt:

#### 🔹 Trên Windows:
Chạy bằng PowerShell:
```powershell
.\start_all.ps1
```
*Hoặc nhấp đúp chuột vào tệp `start_all.bat`.*

#### 🔹 Trên Linux / macOS:
```bash
chmod +x start_all.sh
./start_all.sh
```

---

### 3.2. Khởi chạy bằng Docker Compose (Containerized Production)

Triển khai trọn bộ 3 dịch vụ: Cơ sở dữ liệu PostgreSQL 15, Máy chủ Backend FastAPI (Uvicorn) và Giao diện người dùng Frontend (Nginx Reverse Proxy):

```bash
# 1. Build và khởi chạy các containers ngầm
docker compose up --build -d

# 2. Kiểm tra trạng thái hoạt động của các container
docker compose ps
```

- **Giao diện Web**: `http://localhost` hoặc `http://localhost:5173`
- **Backend API Docs (Swagger)**: `http://localhost:8000/docs`
- **Dừng hệ thống**: `docker compose down`

---

### 3.3. Khởi chạy thủ công từng dịch vụ (Local Development)

#### Bước 1: Khởi động Backend (FastAPI + Uvicorn)
```powershell
# 1. Tạo & kích hoạt môi trường ảo
python -m venv venv
.\venv\Scripts\Activate.ps1   # Linux/macOS: source venv/bin/activate

# 2. Cài đặt thư viện
pip install -r requirements.txt

# 3. Tạo file cấu hình môi trường .env
Copy-Item .env.example .env

# 4. Nạp dữ liệu demo TP.HCM
python scripts/seed_demo_data.py

# 5. Khởi động server FastAPI với Uvicorn
uvicorn app.main:app --reload --port 8000
```

#### Bước 2: Khởi động Frontend (React + Vite)
```powershell
cd frontend
npm install
npm run dev
```
Truy cập ứng dụng tại: `http://localhost:5173`.

---

### 3.4. Hướng dẫn triển khai lên Cloud miễn phí có HTTPS (NFR-SEC-02, SRS 2.4)

Khi triển khai lên môi trường Internet, hệ thống hỗ trợ các dịch vụ Cloud miễn phí phổ biến với chứng chỉ SSL/TLS tự động:

1. **Cơ sở dữ liệu (Database)**: Sử dụng **Supabase** hoặc **Neon.tech** (PostgreSQL Serverless miễn phí, tự động kích hoạt kết nối SSL `sslmode=require`).
2. **Backend**: Triển khai lên **Render.com** (Web Service, cấu hình Start Command: `uvicorn app.main:app --host 0.0.0.0 --port 10000`, tự cấp HTTPS).
3. **Frontend**: Triển khai lên **Vercel** hoặc **Netlify** (kết nối repo GitHub, thiết lập biến môi trường `VITE_API_URL=https://<your-backend-app>.onrender.com`, tự cấp HTTPS miễn phí với Let's Encrypt).

---

## 4. Tài khoản mặc định & Dữ liệu Demo TP.HCM (Default Accounts)

Hệ thống đã nạp sẵn dữ liệu demo phong phú tại 20 quận/huyện TP.HCM cùng các tài khoản thử nghiệm:

| Vai trò | Email đăng nhập | Mật khẩu | Quyền hạn & Chức năng |
|:---|:---|:---|:---|
| **Quản trị viên (Admin)** | `admin@ecofind.vn` | `Admin@123` | Quản lý hàng đợi duyệt tin (`/admin/moderation`), hạ điểm, từ chối tin kèm lý do, xử lý báo cáo vi phạm |
| **Người bán (Seller)** | `seller@ecofind.vn` | `Seller@123` | Đăng tin, chấm 3 điểm tình trạng, quản lý tin của tôi (`/my-listings`), sửa tin, nộp duyệt lại tin bị từ chối |
| **Người mua (Buyer)** | `buyer@ecofind.vn` | `Buyer@123` | Xem bản đồ, tìm kiếm, lọc tin theo bán kính/quận/giá, lưu yêu thích, gửi báo cáo vi phạm |

---

## 5. Kiểm thử luồng khép kín (End-to-End User Journey Verification)

Kịch bản kiểm thử luồng nghiệp vụ cuối từ đầu đến cuối:

### 5.1. Chạy bài kiểm thử tự động E2E Test
```powershell
pytest tests/test_e2e_flow.py -v
```
Bài test `test_complete_end_to_end_user_journey` tự động thực thi 10 bước khép kín:
1. **Đăng ký**: Khách đăng ký tài khoản người bán mới (`POST /api/auth/register`).
2. **Đăng nhập**: Nhận mã phiên JWT token (`POST /api/auth/login`).
3. **Đăng tin**: Gửi tin đồ cũ kèm 3 điểm thành phần tự chấm và ảnh (`POST /api/listings`).
4. **Kiểm tra trạng thái**: Tin có trạng thái `pending`, tính điểm đúng trọng số và **chưa xuất hiện** trên bản đồ công khai (TC-07).
5. **Tin của tôi**: Người bán thấy tin trong tab Chờ duyệt (`GET /api/me/listings?status=pending`).
6. **Admin đăng nhập**: Admin đăng nhập vào hệ thống.
7. **Hàng đợi kiểm duyệt**: Admin thấy tin chờ duyệt (`GET /api/admin/listings?status=pending`).
8. **Admin duyệt**: Admin duyệt tin và ghi nhận review note (`POST /api/admin/listings/{id}/approve`).
9. **Hiện lên bản đồ**: Khách xem bản đồ (`GET /api/listings?bbox=...`) và **thấy ngay tin đăng** hiển thị kèm điểm tình trạng và huy hiệu chất lượng (TC-10).
10. **Xem chi tiết**: Khách mở chi tiết tin (`GET /api/listings/{id}`) xem trọn vẹn thông tin người bán, album ảnh và cách chấm điểm.

---

## 6. Bộ kiểm thử tự động (Automated Test Suite)

Dự án sở hữu bộ kiểm thử tự động toàn diện với độ bao phủ cao (High Coverage):

### 6.1. Kiểm thử Backend (198 tests - 100% Pass)
```powershell
pytest -v
```
- `tests/test_auth.py`: Xác thực JWT, đăng ký, đăng nhập
- `tests/test_lockout.py`: Khóa tài khoản sau 5 lần sai
- `tests/test_create_listing_api.py`: Đăng tin & kiểm tra quy tắc nghiệp vụ
- `tests/test_admin_approve_listing_api.py`: Duyệt tin & hạ điểm thành phần
- `tests/test_admin_reject_listing_api.py`: Từ chối tin kèm lý do vi phạm
- `tests/test_me_listings_api.py`: Quản lý tin của tôi & bộ lọc trạng thái
- `tests/test_report_listing_api.py`: Báo cáo tin vi phạm
- `tests/test_e2e_flow.py`: Kiểm thử luồng nghiệp vụ khép kín từ đăng ký đến duyệt tin hiển thị trên bản đồ

### 6.2. Kiểm thử Frontend (140 tests - 100% Pass)
```powershell
cd frontend
npm test
```
Bao gồm kiểm thử tương tác bản đồ, bộ lọc tìm kiếm, bộ đếm ký tự báo cáo vi phạm, form đăng/sửa tin, phân quyền và kiểm thử giao diện Responsive trên màn hình 360px, 768px, 1920px (NFR-USA-01, NFR-USA-02).

---

## 7. Kiểm thử tải & hiệu năng với 10.000 tin đăng (Task TE9C757, TE9C75B)

- **Sinh 10.000 tin mẫu**: `python scripts/generate_10k_listings.py` (hoàn thành trong ~0.25s).
- **Chạy benchmark tự động**: `python scripts/benchmark_performance.py`.
- **Kết quả đo lường (10 lần lặp)**:
  - **TC-02 (NFR-PER-01)**: Tải marker bản đồ trên 4G đạt **89.07 ms** (Yêu cầu: $\le 3.000$ ms, **nhanh gấp 33 lần**).
  - **TC-03 (NFR-PER-02)**: Tìm kiếm & lọc $\le 50$ tin đạt **20.44 ms** (Yêu cầu: $\le 2.000$ ms, **nhanh gấp 98 lần**).
- **Giải pháp chỉ mục tăng tốc tìm từ khóa pg_trgm (Task TE9C75B, SDD 6.2)**:
  - Kịch bản: Khi khối lượng dữ liệu mở rộng hàng trăm ngàn tin hoặc nếu thời gian tìm kiếm từ khóa vượt quá 2 giây, kích hoạt chỉ mục GIN Trigram:
    ```bash
    psql -U postgres -d ecofind_db -f scripts/add_pg_trgm.sql
    ```
  - Cài đặt extension `pg_trgm`, tạo chỉ mục GIN trên `title`, `description` và `(title || ' ' || description)` cho các tin `selling`, chuyển đổi Seq Scan sang Bitmap Index Scan giúp duy trì thời gian tìm kiếm $\le 2$ giây.
- Chi tiết xem tại báo cáo [docs/PERFORMANCE_REPORT_10K.md](docs/PERFORMANCE_REPORT_10K.md).

---

## 8. Quy ước Git & Traceability

- **Nhánh chính**: `main` (Production), `dev` (Tích hợp Sprint).
- **Quy ước Commit**: `<Mã Task>: <Mô tả chi tiết>` (Ví dụ: `TE9C75A: devops: trien khai docker-compose, script khoi chay 1 lenh va kiem thu luong e2e`).
- **Truy vết**: Đầy đủ các Use Cases (UC-01 đến UC-10), Functional Requirements (FR-01 đến FR-15) và Non-functional Requirements (NFR-PER, NFR-SEC, NFR-USA, NFR-MNT).
