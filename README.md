# EcoFind - Nền tảng Mua bán Đồ cũ Tích hợp Bản đồ & Đánh giá Tình trạng

> **Dự án Lab Rk1 / Kỹ nghệ Phần mềm**  
> Tuân thủ đặc tả yêu cầu **IEEE Std 830 (SRS)** và tài liệu thiết kế kiến trúc **IEEE Std 1016 (SDD)**.

---

## 1. Giới thiệu tổng quan (Project Overview)

**EcoFind** là nền tảng thương mại điện tử kết nối người mua và người bán đồ cũ (SecondHand) theo mô hình bản đồ địa lý trực quan tại khu vực **TP. Hồ Chí Minh**. Điểm cốt lõi của hệ thống là **Cơ chế đánh giá tình trạng minh bạch (Condition Score)** dựa trên 3 tiêu chí có trọng số (Ngoại quan, Công năng, Phụ kiện), kết hợp quy trình kiểm duyệt của Quản trị viên (Admin), quản lý hồ sơ cá nhân/người bán và cơ chế tự quản lý tin đăng của Người bán.

> **Phạm vi Phiên bản 1.0 (SRS Mục 1.2):** Người mua liên hệ người bán trực tiếp qua **số điện thoại** và hẹn gặp kiểm tra thực tế món đồ trước khi thanh toán. Hệ thống không tích hợp nhắn tin trong ứng dụng, đặt cọc hay thanh toán trực tuyến.

### Các phân hệ chính:
- 🗺️ **Bản đồ tương tác (Leaflet & Google Maps Tiles - UC-02, UC-03):** Tìm kiếm tin đăng theo khung nhìn (`bbox`), bán kính (`1–20 km` theo Haversine), quận/huyện, từ khóa và bộ lọc giá / điểm tình trạng / đồ cho tặng (`0 đ`). Sử dụng cấu hình Google Maps Tiles cố định tiếng Việt (`hl=vi&gl=VN`) qua [leafletCluster.js](frontend/src/utils/leafletCluster.js) và tự động gộp cụm marker khi có trên 30 tin.
- 🔐 **Xác thực, Phân quyền & Xử lý hết hạn phiên (UC-01):** Đăng ký, đăng nhập JWT access token, khóa đăng nhập 15 phút sau 5 lần sai liên tiếp (`HTTP 423`), kiểm tra vai trò (`user` / `admin`), băm mật khẩu với Bcrypt; tự động xóa phiên và chuyển hướng về `/login` khi backend trả về `HTTP 401`.
- 👤 **Trang cá nhân & Hồ sơ người bán công khai (UC-10, FR-16):** Xem thống kê hoạt động, cập nhật họ tên/SĐT, đổi mật khẩu tại `/profile`, và xem trang người bán công khai kèm danh sách tin đang bán tại `/sellers/:userId` (ẩn email/SĐT riêng tư).
- 📝 **Đăng tin & Chấm điểm tình trạng (UC-05, BR-01..BR-05):** Đăng tin kèm 1–5 ảnh JPG/PNG (`<= 5 MB`), chọn vị trí qua gợi ý địa chỉ tự động (`Autocomplete`), định vị ngược GPS (`Reverse Geocode`) hoặc ghim tay trên bản đồ; hệ thống tự tính điểm tổng và phân hạng (`Như mới`, `Tốt`, `Khá`, `Cũ`).
- 📦 **Quản lý tin của tôi (UC-06, FR-10):** Phân loại theo 5 trạng thái (`selling`, `pending`, `hidden`, `sold`, `rejected`), hỗ trợ ẩn/hiện/đánh dấu đã bán, sửa tin và nộp duyệt lại tin bị từ chối (cảnh báo duyệt lại khi sửa điểm hoặc ảnh).
- 🛡️ **Kiểm duyệt & Quản trị nâng cao (UC-09, FR-13..FR-15, FR-17):** Bảng điều khiển `/admin` với KPI toàn sàn & phân bổ danh mục; duyệt tin (hỗ trợ hạ điểm thành phần có ghi chú), từ chối tin kèm lý do, ẩn trực tiếp hoặc khôi phục tin đã ẩn, xử lý báo cáo vi phạm (`hide` / `dismiss`), và khóa/mở khóa tài khoản thành viên theo thời hạn.
- ⭐ **Lưu yêu thích & Báo cáo vi phạm (UC-07, UC-08):** Lưu tin quan tâm tại `/favorites`; gửi báo cáo với 4 lý do chuẩn hóa (`wrong_score`, `scam`, `prohibited`, `other`) kèm ghi chú tối đa 200 ký tự, chặn báo cáo trùng hoặc tự báo cáo tin của mình.

---

## 2. Công nghệ & Kiến trúc 3 tầng (Tech Stack & 3-Tier Architecture)

Hệ thống tuân thủ **Kiến trúc 3 tầng (Presentation Tier ↔ Business Logic Tier ↔ Data Access Tier)** với 6 bảng PostgreSQL chuẩn hóa theo SDD Mục 6.1:

- **Backend:** Python 3.12+, FastAPI, SQLAlchemy 2.0 Async (`asyncpg`), PostgreSQL 15, Pydantic v2, PyJWT, Passlib/Bcrypt, HTTPX.
- **Frontend:** React 19 (`^19.3.1`), Vite 8, Tailwind CSS 4 (`@tailwindcss/vite`), React Router v7, Lucide Icons, Leaflet (`1.9.4`) + `leaflet.markercluster`, Fetch API (`fetchWithAuth` kèm JWT & `401` handler).
- **Dịch vụ ngoài (qua Adapter Layer):** Lưu trữ ảnh cục bộ (`ImageStorageAdapter`), Geocoding đa nguồn (`GeocodeAdapter`: Google Geocoding nếu có API key → ArcGIS PointAddress → OpenStreetMap Nominatim fallback).

```text
EcoFind_Project/
├── app/                              # Backend (FastAPI + SQLAlchemy 2.0 Async + Uvicorn)
│   ├── main.py                       # Khởi chạy FastAPI, CORS, static /uploads & Exception handlers
│   ├── core/                         # config, database, dependencies, districts, error_handlers, exceptions, geo, security
│   ├── models/                       # SQLAlchemy ORM Models (user, listing, category, listing_photo, favorite, report)
│   ├── schemas/                      # Pydantic Schemas (Validation & camelCase JSON serialization)
│   ├── routers/                      # 10 API Routers + health (auth, listings, categories, admin, favorites, reports, me, users, geocode, upload, health)
│   ├── services/                     # Business Logic Layer (auth, category, favorite, geocode, listing, moderation, report, score_calculator, user)
│   ├── repositories/                 # Data Access Layer (category, favorite, listing, report, user)
│   └── adapters/                     # Adapter Layer (image_storage_adapter, geocode_adapter)
├── frontend/                         # Frontend (React 19 + Vite 8 + Tailwind CSS 4 + Leaflet)
│   ├── src/
│   │   ├── api/                      # Fetch wrapper (client.js) & module gọi API (admin, auth, categories, favorites, geocode, listings, users)
│   │   ├── components/               # Header, Footer, BottomNav, Layout, MapView, LocationPickerMap, ConditionScorer, PhotoUploader, AdminListingModal, SearchAndFilterBar, SearchResultsList, ProtectedRoute, AdminRoute
│   │   ├── context/                  # AuthContext (JWT session, cross-tab sync, xử lý 401 hết hạn phiên)
│   │   ├── hooks/                    # useGeolocation
│   │   ├── pages/                    # HomePage, ListingDetailPage, LoginPage, RegisterPage, PostListingPage, MyListingsPage, FavoritesPage, ProfilePage, AdminPage, NotFoundPage
│   │   ├── utils/                    # authToken, imageFallback, leaflet-global, leafletCluster
│   │   └── __tests__/                # Bộ kiểm thử Frontend Vitest (26 files, 152 tests)
│   ├── Dockerfile                    # Multi-stage Docker build cho Frontend
│   ├── nginx.conf                    # Nginx reverse proxy + Gzip + security headers
│   └── package.json
├── docs/                             # Tài liệu bàn giao, kiến trúc & báo cáo kiểm thử
│   ├── HANDOVER_AND_DEMO_SCRIPT.md   # Tài liệu bàn giao & kịch bản demo UC-01..UC-10
│   ├── DEMO_GUIDE.md                 # Hướng dẫn thuyết trình & trải nghiệm theo vai trò
│   ├── ARCHITECTURE_REVIEW_3TIER.md  # Báo cáo rà soát kiến trúc 3 tầng & module bản đồ (NFR-MNT-01)
│   ├── PERFORMANCE_REPORT_10K.md     # Báo cáo đo lường hiệu năng với 10.000 tin mẫu (TC-02, TC-03)
│   ├── RESPONSIVE_USABILITY_REPORT.md# Báo cáo kiểm thử Responsive (360px/768px/1920px) & Usability
│   └── benchmark_results.json        # Dữ liệu đo lường chi tiết 10 lần chạy
├── postman/                          # Bộ kiểm thử API Postman (TC-01 đến TC-12)
│   ├── EcoFind_TC01_to_TC12.postman_collection.json
│   ├── EcoFind.postman_environment.json
│   └── README.md
├── scripts/                          # Scripts khởi tạo CSDL, Seed Demo & Benchmark
│   ├── seed_demo_listings.py         # Seed dữ liệu demo TP.HCM (7 danh mục, 5 tài khoản, 96 tin tại 21 quận/huyện)
│   ├── seed_demo_data.py             # Proxy điều hướng sang seed_demo_listings.py
│   ├── generate_10k_listings.py      # Sinh 10.000 tin mẫu tại 20 quận/huyện TP.HCM
│   ├── benchmark_performance.py      # Đo lường hiệu năng tự động TC-02 & TC-03
│   ├── build_postman_collection.py   # Tạo Postman Collection
│   ├── add_pg_trgm.sql               # Chỉ mục PostgreSQL GIN Trigram (pg_trgm)
│   ├── create_tables.sql             # DDL tạo cấu trúc 6 bảng CSDL
│   ├── create_indexes.sql            # Chỉ mục tối ưu hiệu năng (idx_listings_map, idx_listings_seller...)
│   └── seed_data.sql                 # Dữ liệu khởi tạo (Danh mục & Admin)
├── tests/                            # Bộ kiểm thử tự động Backend (219 tests gồm luồng E2E)
├── Dockerfile                        # Dockerfile cho Backend FastAPI
├── docker-compose.yml                # Khởi chạy trọn gói: PostgreSQL 15 + Backend + Frontend
├── .env.example / .env.docker        # Biến môi trường mẫu cho Local & Docker
├── start_all.ps1 / start_all.bat     # Khởi chạy lại nhanh 1 lệnh trên Windows (sau khi đã cài đặt)
├── start_all.sh                      # Khởi chạy lại nhanh 1 lệnh trên Linux / macOS
├── requirements.txt                  # Thư viện Backend Python
└── README.md                         # Tài liệu hướng dẫn cài đặt, sử dụng & nghiệm thu
```

---

## 3. Hướng dẫn cài đặt & chạy trên máy mới (Từ khi `git clone`)

### 3.1. Cách 1: Chạy bằng Docker Compose *(Khuyên dùng cho máy trắng — 1 lệnh chạy ngay)*

Chỉ cần cài **Docker Desktop** và có kết nối Internet (không cần cài riêng Python, Node.js hay PostgreSQL). Toàn bộ 3 container (`ecofind_db`, `ecofind_backend`, `ecofind_frontend`) sẽ chạy **trực tiếp trên máy local** của bạn:

1. Đảm bảo các cổng `80`, `5173`, `8000`, `5432` trên máy chưa bị dịch vụ khác chiếm dụng (nếu đang chạy PostgreSQL local ngoài Docker, hãy tạm dừng trước hoặc đổi port trong `docker-compose.yml`).
2. Build và khởi chạy trọn bộ hệ thống:
   ```bash
   git clone <URL_REPO_CUA_BAN>
   cd EcoFind_Project
   docker compose up --build -d
   ```
3. Kiểm tra trạng thái container (đợi khoảng 10–20 giây ở lần đầu để DB chạy SQL khởi tạo và Backend nạp 96 tin mẫu):
   ```bash
   docker compose ps
   docker compose logs -f backend
   ```
4. Truy cập trên trình duyệt:
   - **Giao diện Web:** `http://localhost` hoặc `http://localhost:5173`
   - **Backend API Docs (Swagger):** `http://localhost:8000/docs`
   - **Dừng hệ thống:** `docker compose down`

> **Lưu ý:** `docker-compose.yml` dùng cấu hình sẵn trong `.env.docker`, tự động chạy 3 tệp SQL (`create_tables.sql`, `create_indexes.sql`, `seed_data.sql`) khi tạo mới PostgreSQL volume và tự gọi `seed_demo_data.py` mỗi lần container `backend` khởi động.

---

### 3.2. Cách 2: Cài đặt & chạy thủ công trên Local (Không dùng Docker)

#### Điều kiện tiên quyết
- **Python 3.12+**
- **Node.js 20 LTS+** *(khớp Vite 8 / Vitest 5 / React 19)*
- **PostgreSQL 15+** đang chạy tại cổng `5432`
- **Kết nối Internet** *(để tải gạch bản đồ Google Tiles, Geocoding và ảnh mẫu Unsplash)*

#### Bước 1: Clone dự án & tạo file `.env`
Vì `.env` nằm trong `.gitignore`, sau khi clone cần tạo từ file mẫu `.env.example`:
```powershell
git clone <URL_REPO_CUA_BAN>
cd EcoFind_Project
Copy-Item .env.example .env      # Linux/macOS: cp .env.example .env
```
Mở file `.env` và chỉnh lại đúng thông số PostgreSQL trên máy bạn:
```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=<mat_khau_postgres_cua_ban>
DB_NAME=ecofind_db

JWT_SECRET_KEY=<chuoi_bi_mat_tu_chon_it_nhat_32_ky_tu>
CORS_ORIGINS=["http://localhost:3000","http://localhost:5173"]
```
*(Tùy chọn: có thể thêm `GOOGLE_MAPS_API_KEY=...` và `GEOCODE_PROVIDER=auto`. Nếu bỏ trống `GOOGLE_MAPS_API_KEY`, hệ thống vẫn tự định vị và gợi ý địa chỉ qua ArcGIS PointAddress + Nominatim).*

#### Bước 2: Tạo Database & Khởi tạo Schema SQL *(Bắt buộc trước khi seed)*
> **Quan trọng:** `app/main.py` và `seed_demo_listings.py` **không tự tạo bảng** hay **7 danh mục**. Cần chạy đủ 3 tệp SQL bên dưới trước:

```bash
psql -U postgres -c "CREATE DATABASE ecofind_db WITH ENCODING 'UTF8';"
psql -U postgres -d ecofind_db -f scripts/create_tables.sql
psql -U postgres -d ecofind_db -f scripts/create_indexes.sql
psql -U postgres -d ecofind_db -f scripts/seed_data.sql
```
*(Khuyến nghị thêm nếu muốn kích hoạt tìm kiếm full-text nhanh `pg_trgm`):*
```bash
psql -U postgres -d ecofind_db -f scripts/add_pg_trgm.sql
```

#### Bước 3: Cài đặt Backend, nạp dữ liệu demo & chạy API
```powershell
# 1. Tạo & kích hoạt môi trường ảo Python
python -m venv venv
.\venv\Scripts\Activate.ps1      # Linux/macOS: source venv/bin/activate

# 2. Cài đặt thư viện Backend
pip install -r requirements.txt

# 3. Nạp 5 tài khoản demo & 96 tin đăng TP.HCM
python scripts/seed_demo_listings.py

# 4. Khởi động Backend API
uvicorn app.main:app --reload --port 8000
```

#### Bước 4: Cài đặt & chạy Frontend (trên terminal thứ hai)
```powershell
cd frontend
npm install
npm run dev
```
*(Khi chạy dev local, **không cần** tạo `.env` trong `frontend/` vì [frontend/vite.config.js](frontend/vite.config.js) đã cấu hình proxy `/api` và `/uploads` sang `http://localhost:8000`).*

#### Bước 5: Kiểm tra sau khi khởi động
- Kiểm tra Backend + DB: mở `http://localhost:8000/api/health` (trả về `"status": "ok"`, `"database": "connected"`).
- Mở ứng dụng tại `http://localhost:5173`: bản đồ hiển thị khu vực TP.HCM cùng các marker tin đăng.

---

### 3.3. Cách 3: Khởi chạy lại nhanh bằng 1 lệnh *(Sau khi đã hoàn tất cài đặt ở mục 3.2)*

Khi máy đã có sẵn `venv`, `frontend/node_modules`, `.env` và schema DB đã khởi tạo:
- **Windows (PowerShell):** `.\start_all.ps1` *(hoặc nhấp đúp `start_all.bat`)*
- **Linux / macOS:**
  ```bash
  chmod +x start_all.sh
  ./start_all.sh
  ```

---

### 3.4. Khắc phục nhanh các lỗi thường gặp khi mới chạy
| Triệu chứng | Nguyên nhân | Cách xử lý |
|:---|:---|:---|
| `relation "users" does not exist` hoặc lỗi `fk_listings_category` | Chưa chạy 3 file SQL khởi tạo bảng & danh mục | Chạy lại Bước 2 ở mục 3.2 (`create_tables.sql`, `create_indexes.sql`, `seed_data.sql`) |
| `password authentication failed for user "postgres"` | Sai mật khẩu DB trong `.env` | Sửa `DB_PASSWORD` trong `.env` cho khớp PostgreSQL trên máy |
| `port is already allocated` khi chạy Docker | PostgreSQL/IIS/Vite ngoài máy đang chiếm cổng `5432`, `80`, `5173` hoặc `8000` | Tạm tắt service đang chiếm cổng rồi chạy lại `docker compose up -d` |
| Trang Frontend gọi API bị `404` hoặc `502` lúc chạy dev | Chưa bật Backend tại cổng `8000` | Bật `uvicorn app.main:app --reload --port 8000` |
| Bản đồ/ảnh mẫu không hiện hoặc còn giao diện cache cũ | Mất Internet hoặc trình duyệt giữ cache cũ | Kiểm tra Internet và bấm `Ctrl + Shift + R` |

---

### 3.5. Hướng dẫn triển khai lên Cloud có HTTPS (NFR-SEC-02, SRS 2.4)
1. **Database:** PostgreSQL Serverless trên **Supabase** hoặc **Neon.tech** (`sslmode=require`), import `create_tables.sql`, `create_indexes.sql`, `seed_data.sql`.
2. **Backend:** Triển khai lên **Render.com** (`uvicorn app.main:app --host 0.0.0.0 --port 10000`, cấu hình biến môi trường DB, `JWT_SECRET_KEY`, `CORS_ORIGINS` chứa domain frontend).
3. **Frontend:** Triển khai lên **Vercel** hoặc **Netlify** (Root Directory `frontend`, thiết lập `VITE_API_URL=https://<your-backend-app>.onrender.com`, tự cấp SSL Let's Encrypt).

---

## 4. Tài khoản Demo & Dữ liệu mẫu TP.HCM

Script [seed_demo_listings.py](scripts/seed_demo_listings.py) nạp sẵn **7 danh mục**, **96 tin đăng** (`81` đang bán, `8` chờ duyệt, `4` bị từ chối, `3` đã bán) phân bố tại **21 quận/huyện TP.HCM**, kèm **4 báo cáo vi phạm** và **4 tin yêu thích** cho người mua:

| Vai trò | Email đăng nhập | Mật khẩu | Tên hiển thị | Quyền hạn & Kịch bản trải nghiệm |
|:---|:---|:---|:---|:---|
| **Quản trị viên (Admin)** | `admin@ecofind.vn` | `Admin@123` | Quản trị viên Hệ thống | Bảng điều khiển `/admin`: xem KPI sàn, duyệt/hạ điểm/từ chối 8 tin chờ duyệt, ẩn/khôi phục tin, xử lý 4 báo cáo vi phạm, khóa/mở khóa thành viên |
| **Người bán (Seller 1)** | `seller1@ecofind.vn` | `Demo@1234` | Nguyễn Văn Hùng | Quản lý tin đồ công nghệ (`/my-listings`), đăng tin mới (`/post`), sửa tin, ẩn/hiện tin, xem lý do từ chối |
| **Người bán (Seller 2)** | `seller2@ecofind.vn` | `Demo@1234` | Trần Thị Mai | Quản lý tin đồ gia dụng, nội thất, thời trang, đánh dấu đã bán |
| **Người mua (Buyer)** | `buyer@ecofind.vn` | `Demo@1234` | Lê Hoàng Nam | Xem bản đồ, tìm kiếm/lọc, xem SĐT người bán để liên lạc trực tiếp, xem 4 tin đã lưu (`/favorites`), gửi báo cáo vi phạm, quản lý `/profile` |
| **Người bán (Mặc định)** | `seller@ecofind.vn` | `Seller@123` | Nguyễn Văn Người Bán | Tài khoản người bán tương thích với kịch bản kiểm thử ban đầu |

---

## 5. Kiểm thử luồng khép kín (End-to-End User Journey)

```powershell
pytest tests/test_e2e_flow.py -v
```

Bài test `test_complete_end_to_end_user_journey` tự động kiểm chứng 10 bước khép kín và tự dọn sạch bản ghi test + ảnh giả sau khi kết thúc (`_cleanup_e2e_artifacts`):
1. **Đăng ký** tài khoản người bán mới (`POST /api/auth/register`).
2. **Đăng nhập** nhận JWT token (`POST /api/auth/login`).
3. **Đăng tin** kèm 3 điểm thành phần và ảnh (`POST /api/listings`).
4. **Kiểm tra trạng thái** `pending`, tính đúng `totalScore` theo BR-01 và chưa hiện lên bản đồ công khai (`TC-07`).
5. **Tin của tôi** thấy tin trong danh sách chờ duyệt (`GET /api/me/listings?status=pending`).
6. **Admin đăng nhập** vào hệ thống.
7. **Hàng đợi kiểm duyệt** thấy tin chờ duyệt (`GET /api/admin/listings?status=pending`).
8. **Admin duyệt** tin kèm ghi chú (`POST /api/admin/listings/{id}/approve`).
9. **Hiển thị trên bản đồ** công khai (`GET /api/listings?bbox=...`, `TC-10`).
10. **Xem chi tiết** tin đăng (`GET /api/listings/{id}`) với đầy đủ thông tin người bán, ảnh và 3 điểm thành phần.

---

## 6. Bộ kiểm thử tự động (Automated Test Suite)

### 6.1. Kiểm thử Backend (219 tests — 100% Pass)
```powershell
pytest -v
```
- `tests/test_auth.py`, `tests/test_lockout.py`, `tests/test_dependencies.py`: Đăng ký, đăng nhập JWT, khóa tài khoản 5 lần sai, phân quyền.
- `tests/test_create_listing_api.py`, `tests/test_update_listing_api.py`, `tests/test_upload_photos_api.py`, `tests/test_score_calculator.py`, `tests/test_geocode_api.py`: Đăng/sửa tin, tải ảnh, tính điểm BR-01/BR-02 và Geocoding đa nguồn.
- `tests/test_listings_map_api.py`, `tests/test_listings_search_api.py`, `tests/test_listings_filter_api.py`, `tests/test_listings_sort_minscore_api.py`, `tests/test_listings_detail_api.py`: Bản đồ `bbox`, bán kính, tìm kiếm/lọc và chi tiết tin.
- `tests/test_me_listings_api.py`, `tests/test_listing_status_api.py`, `tests/test_favorites_api.py`, `tests/test_report_listing_api.py`, `tests/test_user_profile_api.py`: Tin của tôi, trạng thái tin, yêu thích, báo cáo vi phạm, hồ sơ cá nhân & người bán công khai.
- `tests/test_admin_listings_api.py`, `tests/test_admin_approve_listing_api.py`, `tests/test_admin_reject_listing_api.py`, `tests/test_admin_reports_api.py`, `tests/test_admin_management_api.py`: Kiểm duyệt, xử lý báo cáo, KPI sàn, ẩn/khôi phục tin và khóa/mở khóa thành viên.
- `tests/test_create_tables_sql.py`, `tests/test_seed_data_sql.py`, `tests/test_pg_trgm_sql.py`, `tests/test_exception_handlers.py`, `tests/test_health.py`, `tests/test_e2e_flow.py`: Kiểm tra DDL SQL, exception handler thống nhất và luồng E2E khép kín.

### 6.2. Kiểm thử Frontend & Build (26 files, 152 tests — 100% Pass)
```powershell
cd frontend
npm test
npm run build
```
Bao phủ tương tác bản đồ Google Tiles & cụm marker, bộ lọc tìm kiếm, Autocomplete/Reverse Geocode khi chọn vị trí, bộ đếm ký tự báo cáo vi phạm, form đăng/sửa tin, trang cá nhân & người bán công khai, quản trị viên mở rộng, xử lý hết hạn phiên JWT `401`, và giao diện Responsive trên 360px / 768px / 1920px (`NFR-USA-01`, `NFR-USA-02`).

---

## 7. Kiểm thử tải & hiệu năng với 10.000 tin đăng (TE9C757, TE9C75B)

- **Sinh 10.000 tin mẫu:** `python scripts/generate_10k_listings.py`
- **Chạy benchmark tự động:** `python scripts/benchmark_performance.py`
- **Kết quả đo lường (10 lần lặp):**
  - **TC-02 (NFR-PER-01):** Tải marker bản đồ trên mạng 4G đạt trung bình **89.07 ms** (Yêu cầu: $\le 3.000$ ms).
  - **TC-03 (NFR-PER-02):** Tìm kiếm & lọc $\le 50$ tin đạt trung bình **20.44 ms** (Yêu cầu: $\le 2.000$ ms).
- **Chỉ mục PostgreSQL Trigram (`pg_trgm`, SDD 6.2):**
  ```bash
  psql -U postgres -d ecofind_db -f scripts/add_pg_trgm.sql
  ```
- Chi tiết xem tại [docs/PERFORMANCE_REPORT_10K.md](docs/PERFORMANCE_REPORT_10K.md).

---

## 8. Quy ước Git & Traceability

- **Nhánh chính:** `main` (Production / Bản chốt), `dev` (Tích hợp phát triển).
- **Quy ước Commit:** `<Mã Task hoặc Conventional Type>(<scope>): <mô tả>` (Ví dụ: `TE9C75A: devops: ...`, `feat(ui-docs): ...`).
- **Truy vết tài liệu:** Bao phủ đầy đủ **Use Cases** (`UC-01` đến `UC-10`), **Functional Requirements** (`FR-01` đến `FR-17`), **Business Rules** (`BR-01` đến `BR-05`) và **Non-functional Requirements** (`NFR-PER`, `NFR-SEC`, `NFR-USA`, `NFR-MNT`) đồng bộ giữa `Tài liệu SRS .docx`, `Tài liệu SDD.docx`, [HANDOVER_AND_DEMO_SCRIPT.md](docs/HANDOVER_AND_DEMO_SCRIPT.md) và [ARCHITECTURE_REVIEW_3TIER.md](docs/ARCHITECTURE_REVIEW_3TIER.md).
