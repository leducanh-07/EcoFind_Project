# EcoFind - Nền tảng Mua bán Đồ cũ Tích hợp Bản đồ & Đánh giá Tình trạng

> **Dự án Lab Rk1 / Kỹ nghệ Phần mềm**  
> Tuân thủ đặc tả yêu cầu IEEE Std 830 (SRS) và tài liệu thiết kế kiến trúc IEEE Std 1016 (SDD).

---

## 1. Giới thiệu tổng quan (Project Overview)

**EcoFind** là nền tảng thương mại điện tử kết nối người mua và người bán đồ cũ (SecondHand), tập trung vào trải nghiệm trực quan trên bản đồ địa lý khu vực TP.HCM. Điểm đột phá của hệ thống là **Cơ chế đánh giá tình trạng minh bạch (Condition Score)** dựa trên 3 tiêu chí cốt lõi (Ngoại quan, Công năng, Phụ kiện), kết hợp quy trình kiểm duyệt nghiêm ngặt của Quản trị viên (Admin) và tính năng tự điều chỉnh trạng thái thông minh của Người bán.

### Các phân hệ chính (Modules):
- 🗺️ **Bản đồ tương tác (Interactive Map - Leaflet / OSM)**: Tìm kiếm tin đăng theo khung nhìn (bounding box), bán kính (1–20 km theo Haversine), quận/huyện, từ khóa và bộ lọc giá / điểm tình trạng. Marker hiển thị huy hiệu điểm tình trạng trực quan.
- 🔐 **Xác thực & Phân quyền (Authentication & Authorization)**: Đăng ký, đăng nhập JWT access token, kiểm tra vai trò (Admin / Seller / Buyer), bảo mật mật khẩu với thuật toán Bcrypt.
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
├── app/                         # Backend (FastAPI + SQLAlchemy)
│   ├── main.py                  # Khởi chạy ứng dụng FastAPI, middleware CORS & Exception handlers
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
│   ├── package.json
│   └── vite.config.js
├── docs/                        # Tài liệu dự án & Báo cáo kiểm thử hiệu năng
│   ├── PERFORMANCE_REPORT_10K.md# Báo cáo đo lường hiệu năng với 10.000 tin mẫu (TC-02, TC-03)
│   └── benchmark_results.json   # Dữ liệu đo lường chi tiết 10 lần chạy
├── scripts/                     # Scripts hỗ trợ CSDL & Benchmark
│   ├── generate_10k_listings.py # Script sinh 10.000 tin mẫu tại 20 quận/huyện TP.HCM
│   ├── benchmark_performance.py # Script đo lường hiệu năng tự động TC-02 & TC-03
│   ├── add_pg_trgm.sql          # Script cấu hình chỉ mục PostgreSQL Trigram (pg_trgm)
│   ├── create_tables.sql        # DDL tạo cấu trúc 6 bảng CSDL
│   ├── create_indexes.sql       # Chỉ mục tối ưu hóa hiệu năng (idx_listings_map, idx_listings_seller...)
│   ├── seed_data.sql            # Dữ liệu khởi tạo (Danh mục & Admin)
│   └── seed.py                  # Python seeder
├── tests/                       # Bộ kiểm thử tự động Backend (197 tests)
├── uploads/                     # Thư mục lưu trữ hình ảnh tin đăng
├── requirements.txt             # Thư viện Backend Python
└── README.md                    # Tài liệu hướng dẫn sử dụng & nghiệm thu
```

---

## 3. Hướng dẫn cài đặt và khởi chạy (Getting Started)

### 3.1. Yêu cầu môi trường
- **Python**: Phiên bản 3.11 hoặc mới hơn.
- **Node.js**: Phiên bản 18.x hoặc 20.x trở lên, kèm `npm`.
- **Cơ sở dữ liệu**: SQLite (mặc định sẵn có, không cần cài đặt thêm) hoặc PostgreSQL 14+.

---

### 3.2. Cài đặt và Khởi chạy Backend

1. **Tạo và kích hoạt môi trường ảo (Virtualenv):**
   ```powershell
   # Tạo môi trường ảo
   python -m venv venv

   # Kích hoạt môi trường ảo (Windows PowerShell)
   .\venv\Scripts\Activate.ps1
   # (Trên Linux / macOS: source venv/bin/activate)
   ```

2. **Cài đặt các gói phụ thuộc (Dependencies):**
   ```powershell
   pip install -r requirements.txt
   ```

3. **Cấu hình tệp biến môi trường (`.env`):**
   ```powershell
   # Sao chép từ mẫu cấu hình
   Copy-Item .env.example .env
   ```
   *Nội dung `.env` chuẩn:*
   ```ini
   DATABASE_URL=sqlite:///./ecofind.db
   ASYNC_DATABASE_URL=sqlite+aiosqlite:///./ecofind.db
   SECRET_KEY=your-super-secret-jwt-key-min-32-chars-long
   ALGORITHM=HS256
   ACCESS_TOKEN_EXPIRE_MINUTES=1440
   UPLOAD_DIR=uploads
   ```

4. **Khởi tạo dữ liệu mẫu (Seed Data):**
   ```powershell
   python scripts/seed.py
   ```

5. **Khởi chạy máy chủ Backend:**
   ```powershell
   uvicorn app.main:app --reload --port 8000
   ```
   - API Base URL: `http://localhost:8000`
   - Tài liệu tương tác Swagger UI: `http://localhost:8000/docs`
   - Kiểm tra trạng thái: `http://localhost:8000/api/health`

---

### 3.3. Cài đặt và Khởi chạy Frontend

1. **Truy cập thư mục `frontend` và cài đặt packages:**
   ```powershell
   cd frontend
   npm install
   ```

2. **Khởi chạy máy chủ phát triển Frontend:**
   ```powershell
   npm run dev
   ```
   - Giao diện ứng dụng: `http://localhost:5173`

---

## 4. Tài khoản mặc định thử nghiệm (Default Accounts)

Hệ thống đã chuẩn bị sẵn các tài khoản để phục vụ chấm điểm và nghiệm thu:

| Vai trò | Email đăng nhập | Mật khẩu | Quyền hạn |
|:---|:---|:---|:---|
| **Quản trị viên (Admin)** | `admin@ecofind.vn` | `Admin@123` | Toàn quyền kiểm duyệt tin (`/admin/moderation`), hạ điểm, từ chối tin, xem báo cáo |
| **Người bán (Seller)** | `seller@ecofind.vn` | `Seller@123` | Đăng tin, sửa tin, quản lý tin của tôi (`/my-listings`), đổi trạng thái |
| **Người mua (Buyer)** | `buyer@ecofind.vn` | `Buyer@123` | Xem bản đồ, tìm kiếm, lọc tin, lưu yêu thích, gửi báo cáo vi phạm |

---

## 5. Hướng dẫn kiểm thử tự động (Automated Testing)

Dự án sở hữu bộ kiểm thử tự động toàn diện (Test Coverage cao) cho cả 2 tầng:

### 5.1. Chạy toàn bộ kiểm thử Backend (197 tests)
```powershell
# Chạy toàn bộ test suite backend
pytest -v

# Hoặc chạy kiểm thử theo từng chuyên đề
pytest tests/test_auth_api.py -v               # Xác thực JWT & phân quyền
pytest tests/test_listing_api.py -v            # Bản đồ, tìm kiếm & bộ lọc
pytest tests/test_admin_moderation_api.py -v   # Nghiệp vụ duyệt tin & hạ điểm
pytest tests/test_admin_reject_api.py -v       # Nghiệp vụ từ chối tin vi phạm
pytest tests/test_my_listings_api.py -v        # Quản lý tin của tôi & đổi trạng thái
pytest tests/test_report_listing_api.py -v     # Báo cáo tin vi phạm
```
*Kết quả:* **197/197 tests PASSED (100%)**.

### 5.2. Chạy toàn bộ kiểm thử Frontend (129 tests)
```powershell
cd frontend
npm test
```
*Kết quả:* **129/129 tests PASSED (100%)**.

---

## 6. Kiểm thử hiệu năng với 10.000 tin đăng (Task TE9C757)

Hệ thống đã trải qua kiểm thử tải và đo đạc hiệu năng trên tập dữ liệu quy mô lớn (10.000 tin đăng thực tế phân bố trên 20 quận/huyện TP.HCM) nhằm đáp ứng các chỉ tiêu chất lượng **NFR-PER-01** và **NFR-PER-02**.

### 6.1. Sinh 10.000 tin mẫu tại TP.HCM
```powershell
python scripts/generate_10k_listings.py
```
- Sinh chính xác 10.000 tin đăng và 17.429 ảnh trong **~0.25 giây**.
- 9.502 tin ở trạng thái `selling` sẵn sàng trên bản đồ, phân bổ đều 7 danh mục và 20 quận/huyện.

### 6.2. Chạy Benchmark hiệu năng tự động
```powershell
python scripts/benchmark_performance.py
```

### 6.3. Bảng tổng hợp kết quả đo đạc (10 lần lặp)
| Tiêu chí | Mục tiêu đặc tả SRS | Thực tế trung bình | Thời gian chậm nhất | Đánh giá |
|:---|:---:|:---:|:---:|:---:|
| **TC-02 (NFR-PER-01)**: Tải marker đầu tiên trên 4G | $\le \mathbf{3.000}$ ms | **89.07 ms** | 149.40 ms | **ĐẠT (Nhanh gấp 33 lần)** |
| **TC-03 (NFR-PER-02)**: Tìm kiếm & lọc dữ liệu ($\le 50$ tin) | $\le \mathbf{2.000}$ ms | **20.44 ms** | 34.15 ms | **ĐẠT (Nhanh gấp 98 lần)** |

> Chi tiết báo cáo và biểu đồ phân tích xem tại [docs/PERFORMANCE_REPORT_10K.md](docs/PERFORMANCE_REPORT_10K.md).

---

## 7. Quy ước Git & Danh mục Sprint

- **Nhánh chính**: `main` (Production), `dev` (Tích hợp Sprint).
- **Quy ước Commit**: `<Mã Task>: <Mô tả chi tiết>` (Ví dụ: `TE9C757: test(perf): sinh 10000 tin mau do hieu nang tc02 tc03 va cap nhat readme`).
- **Truy vết**: Đầy đủ các Use Cases (UC-01 đến UC-10), Functional Requirements (FR-01 đến FR-15) và Non-functional Requirements (NFR-PER, NFR-SEC, NFR-MNT).
