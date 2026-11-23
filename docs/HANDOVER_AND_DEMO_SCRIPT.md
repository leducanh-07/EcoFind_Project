# TÀI LIỆU BÀN GIAO HỆ THỐNG & KỊCH BẢN DEMO
## Dự án: Nền tảng Chợ Đồ Cũ EcoFind (SecondHand Map)
**Mã nhiệm vụ bàn giao:** TE9C75D  
**Tiêu chuẩn tài liệu:** Tuân thủ IEEE Std 830 (SRS mục 1.2), IEEE Std 1016 (SDD).

---

## 1. Báo cáo Tổng kết Dự án (Project Summary)

### 1.1. Giới thiệu tổng quan
**EcoFind** là nền tảng thương mại điện tử mua bán đồ cũ thế hệ mới, tích hợp bản đồ địa lý trực quan tại khu vực TP.HCM và **Cơ chế đánh giá tình trạng minh bạch (Condition Scoring)**. Hệ thống giải quyết triệt để 2 vấn đề lớn nhất của thị trường đồ cũ truyền thống:
1. Người mua khó ước lượng khoảng cách và vị trí địa lý của món đồ cần mua.
2. Tình trạng món đồ bị người bán thổi phồng, thiếu cơ sở định lượng để đánh giá chất lượng và mức độ hao mòn thực tế.

### 1.2. Kiến trúc & Công nghệ Bàn giao
- **Kiến trúc:** 3 tầng phân tách độc lập (Presentation Tier $\leftrightarrow$ Business Logic Tier $\leftrightarrow$ Data Access Tier).
- **Backend:** Python 3.12, FastAPI (Asynchronous ASGI), SQLAlchemy 2.0 Async, PostgreSQL, Pydantic v2.
- **Frontend:** React 18, Vite, Tailwind CSS, Lucide Icons.
- **Bản đồ nền:** Thư viện tương tác Leaflet kết hợp **Google Maps Tiles (Google Tiles - chuẩn đường phố `lyrs=m`)** cho trải nghiệm gạch bản đồ sắc nét, tốc độ tải dưới 100ms thông qua máy chủ CDN tại Việt Nam.
- **Dịch vụ hỗ trợ:** PostgreSQL Trigram (`pg_trgm`) tăng tốc tìm kiếm từ khóa tiếng Việt dưới 2s, Nominatim Geocoding adapter, Bcrypt cost factor 12.

---

## 2. Danh Sách Tài Khoản Trải Nghiệm Mẫu

Hệ thống đã chuẩn bị sẵn bộ tài khoản phân quyền chuẩn để phục vụ kiểm thử và nghiệm thu:

| Email | Mật khẩu | Vai trò | Người đại diện | Kịch bản trải nghiệm chính |
| :--- | :--- | :---: | :--- | :--- |
| **`admin@ecofind.vn`** | `Admin@123` | **Quản trị viên (Admin)** | Quản trị viên Hệ thống | Kiểm duyệt tin chờ duyệt, đối soát 3 điểm tình trạng, hạ điểm thành phần, xử lý báo cáo vi phạm (ẩn tin/bỏ qua). |
| **`seller1@ecofind.vn`** | `Demo@1234` | **Người bán (Seller 1)** | Nguyễn Văn Hùng | Quản lý tin đồ công nghệ (Laptop, bàn phím, tai nghe), sửa tin, ẩn/hiện tin, xem tin bị từ chối kèm lý do. |
| **`seller2@ecofind.vn`** | `Demo@1234` | **Người bán (Seller 2)** | Trần Thị Mai | Quản lý tin đồ gia dụng, nội thất, thời trang, đánh dấu tin đã bán. |
| **`buyer@ecofind.vn`** | `Demo@1234` | **Người mua (Buyer)** | Lê Hoàng Nam | Xem 3 tin lưu Yêu thích sẵn, xem số điện thoại người bán, gửi báo cáo vi phạm tin đăng. |
| **`seller@ecofind.vn`** | `Seller@123` | **Người bán (Mặc định)** | Nguyễn Văn Người Bán | Tài khoản người bán tương thích với tài liệu kiểm thử ban đầu. |

---

## 3. Hướng Dẫn Sử Dụng Chi Tiết Cho 3 Actor

### 3.1. Dành cho Khách vãng lai (Guest - Chưa đăng nhập)
1. **Khám phá bản đồ Google Tiles:** Truy cập `http://localhost:5173`, bản đồ tự động định vị trung tâm TP.HCM và hiển thị các ghim đồ cũ quanh khu vực.
2. **Nhận diện chất lượng qua màu sắc (Quy tắc BR-02):**
   - 🟢 **Xanh lá (Như mới - $\ge 9.0$):** Sản phẩm còn nguyên vẹn, mới sử dụng ít.
   - 🔵 **Xanh dương (Tốt - $7.0 - 8.9$):** Hoạt động hoàn hảo, xước xát nhẹ không đáng kể.
   - 🟡 **Vàng cam (Khá - $5.0 - 6.9$):** Có hao mòn ngoại quan nhưng tính năng cốt lõi vẫn dùng tốt.
   - ⚪ **Xám (Cũ - $< 5.0$):** Sản phẩm cũ hoặc đồ cho tặng miễn phí (0 đ).
3. **Tìm kiếm & Bộ lọc:** Tìm theo tên đồ vật, lọc theo danh mục sản phẩm, kéo khoảng giá hoặc bật tùy chọn **"Cho tặng miễn phí (0 đ)"**.
4. **Bảo mật thông tin liên hệ:** Khi xem chi tiết tin, số điện thoại người bán sẽ bị che để chống thu thập số điện thoại trái phép. Hệ thống hiển thị nút **"Đăng nhập để xem số điện thoại"**.

### 3.2. Dành cho Người dùng / Người bán / Người mua (Registered User)
1. **Xem thông tin liên hệ đầy đủ:** Sau khi đăng nhập, mở chi tiết bất kỳ tin đăng nào sẽ thấy số điện thoại người bán kèm nút gọi điện trực tiếp.
2. **Đăng tin bán đồ & Chấm điểm 3 tiêu chí (UC-05, BR-01):**
   - Bấm nút **"Đăng tin"** trên thanh tiêu đề.
   - Nhập thông tin sản phẩm, tải từ 1 đến 5 hình ảnh thực tế.
   - **Tự chấm điểm tình trạng (Thang điểm 0–10):**
     + *Ngoại quan (trọng số 40%):* Vỏ ngoài, màn hình, vết trầy xước.
     + *Công năng (trọng số 40%):* Tính năng, pin, động cơ, độ mượt.
     + *Phụ kiện (trọng số 20%):* Hộp, sạc zin, sách hướng dẫn, bảo hành.
     + *Hệ thống tự động tính điểm tổng và xếp hạng theo công thức:*
       $$\text{Điểm tổng} = 0.4 \times \text{Ngoại quan} + 0.4 \times \text{Công năng} + 0.2 \times \text{Phụ kiện}$$
   - **Chọn vị trí trên bản đồ:** Nhập địa chỉ để tự động tìm tọa độ hoặc bấm trực tiếp lên bản đồ Google Tiles để ghim vị trí.
3. **Quản lý tin tại mục "Tin của tôi" (UC-06):**
   - Phân loại rõ ràng qua 5 tab trạng thái: **Đang bán**, **Chờ duyệt**, **Tạm ẩn**, **Đã bán**, **Bị từ chối**.
   - Với tin bị từ chối: Xem chi tiết lý do từ chối từ Quản trị viên, bấm **"Sửa tin & Gửi lại"** để nộp duyệt lại.
   - Thao tác nhanh: Nút **Tạm ẩn / Hiện lại / Đã bán** được kích hoạt linh hoạt tùy trạng thái cho phép.
4. **Lưu tin Yêu thích (UC-07):** Bấm biểu tượng trái tim để lưu tin quan tâm, xem lại mọi lúc tại trang **"Yêu thích"**.
5. **Báo cáo vi phạm (UC-08):** Bấm nút **"Báo cáo"** khi phát hiện tin khai khống điểm tình trạng, lừa đảo hoặc bán hàng cấm.

### 3.3. Dành cho Quản trị viên (Admin)
1. **Đăng nhập quyền Admin:** Sử dụng tài khoản `admin@ecofind.vn` / `Admin@123`.
2. **Kiểm duyệt tin đăng (UC-09, FR-14, TC-10):**
   - Truy cập trang **"Quản trị"** $\rightarrow$ Tab **"Chờ kiểm duyệt"**.
   - Đối chiếu hình ảnh thực tế với 3 điểm thành phần người bán tự chấm.
   - *Hạ điểm thành phần:* Nếu người bán tự chấm 9.5 nhưng mô tả có vết xước sâu, Admin nhập điểm hạ (ví dụ: 7.5), hệ thống tự động tính lại điểm tổng mới và gửi thông báo lý do hạ điểm cho người bán.
   - *Từ chối tin:* Nhập lý do từ chối rõ ràng nếu tin vi phạm quy chế hoặc thiếu ảnh thực tế.
3. **Xử lý Báo cáo vi phạm (FR-15):**
   - Chuyển sang tab **"Báo cáo vi phạm"**.
   - Xem thông tin người báo cáo, lý do và ghi chú tố cáo.
   - Bấm **"Ẩn tin đăng"** nếu tin vi phạm quy chế (tin sẽ chuyển sang `hidden_by_admin = true`, người bán không thể tự hiện lại).
   - Bấm **"Bỏ qua báo cáo"** nếu xác minh tin đăng hợp lệ.

---

## 4. Kịch Bản Demo Chi Tiết Từng Use Case (UC-01 đến UC-09)

### 🎬 Kịch bản UC-01: Đăng nhập & Khóa tài khoản 15 phút (TC-01)
1. Truy cập trang Đăng nhập.
2. Thử nhập sai mật khẩu 5 lần liên tiếp với tài khoản `buyer@ecofind.vn`.
3. **Kết quả quan sát:** Lần thứ 5 hệ thống khóa tài khoản và hiển thị thông báo: *"Tài khoản tạm thời bị khóa 15 phút do nhập sai mật khẩu quá 5 lần"*. Dù sau đó nhập đúng mật khẩu, hệ thống vẫn chặn để bảo vệ tài khoản theo tiêu chuẩn NFR-SEC-01.

### 🎬 Kịch bản UC-02: Bản đồ Google Tiles & Marker 4 màu (TC-02)
1. Mở trang chủ EcoFind, bản đồ Google Maps Tiles hiển thị sắc nét toàn màn hình.
2. Di chuyển và phóng to/thu nhỏ góc nhìn (pan/zoom): Marker tự động tải lại theo khung nhìn (bounding box) với debounce mượt mà.
3. Khi trong khung nhìn có trên 30 marker: Hệ thống tự động gộp thành cụm Cluster có số lượng.

### 🎬 Kịch bản UC-03: Tìm kiếm tối ưu pg_trgm & Bộ lọc nhanh (TC-03)
1. Nhập từ khóa `"laptop"` hoặc `"tai nghe"` vào ô tìm kiếm: Kết quả lọc ra ngay lập tức dưới 2s nhờ chỉ mục GIN `pg_trgm`.
2. Lọc theo danh mục **"Đồ điện tử"** và chọn mức điểm **"Từ 8.0 điểm (Hạng Tốt trở lên)"**.
3. Bật tùy chọn **"Cho tặng miễn phí (0 đ)"**: Hiển thị ngay các món đồ sinh viên tặng miễn phí.

### 🎬 Kịch bản UC-04: Xem chi tiết & Ẩn hiện số điện thoại
1. Mở một tin khi chưa đăng nhập: Số điện thoại bị ẩn dưới dạng `0901***`.
2. Đăng nhập bằng `buyer@ecofind.vn`: Số điện thoại hiện đầy đủ (`0901234567`) kèm nút gọi ngay.

### 🎬 Kịch bản UC-05: Đăng tin kèm chấm điểm tình trạng 3 tiêu chí (TC-05, TC-06)
1. Đăng nhập `seller1@ecofind.vn`, bấm **Đăng tin**.
2. Nhập tiêu đề, giá bán, tải 2 ảnh. Kéo thanh trượt chấm 3 điểm: Ngoại quan 8.5, Công năng 9.0, Phụ kiện 8.0.
3. Điểm tổng tự động tính toán đạt **8.6 (Hạng Tốt - Xanh dương)**.
4. Ghim vị trí trên bản đồ Google Tiles và bấm **Gửi duyệt**: Tin chuyển sang trạng thái `pending`, chưa hiển thị trên bản đồ công khai.

### 🎬 Kịch bản UC-06: Quản lý tin của tôi & Xem lý do từ chối
1. Vào mục **"Tin của tôi"** của `seller1@ecofind.vn`.
2. Chọn tab **"Bị từ chối"**: Mở tin *"Điện thoại iPhone 7 Plus"*, đọc dòng lý do từ chối của Admin: *"Ảnh chụp màn hình quá tối..."*.
3. Bấm **"Sửa tin & Gửi lại"**, tải ảnh mới rõ nét và gửi lại duyệt.

### 🎬 Kịch bản UC-07: Lưu tin Yêu thích
1. Đăng nhập `buyer@ecofind.vn`, vào trang **"Yêu thích"**: Có sẵn 3 tin mẫu đã lưu.
2. Bấm bỏ lưu một tin: Tin ngay lập tức được dỡ khỏi danh sách với phản hồi mượt mà.

### 🎬 Kịch bản UC-08: Báo cáo tin vi phạm (TC-09)
1. Tài khoản `buyer@ecofind.vn` mở tin *"Laptop Dell Latitude"*.
2. Bấm nút **"Báo cáo"**, chọn lý do *"Khai khống điểm tình trạng"* và nhập ghi chú.
3. Bấm **Gửi báo cáo**: Hệ thống ghi nhận trạng thái `new` và gửi sang hàng đợi Admin.

### 🎬 Kịch bản UC-09: Admin duyệt tin, hạ điểm và xử lý báo cáo (TC-10, TC-11)
1. Đăng nhập `admin@ecofind.vn`, vào mục **"Quản trị"**.
2. Mở tin chờ duyệt *"Máy ảnh cơ Canon EOS M50"*: Người bán tự chấm 10 điểm ngoại quan.
3. Admin thực hiện hạ điểm ngoại quan xuống 7.0, nhập ghi chú kiểm duyệt: *"Vỏ máy có vết xước viền, hạ điểm ngoại quan"*.
4. Bấm **Duyệt tin**: Tin được duyệt sang `selling` với điểm tổng mới cập nhật và xuất hiện ngay lập tức trên bản đồ trang chủ!

---

## 5. Tổng Hợp Kết Quả Kiểm Thử Toàn Diện

| Bộ kiểm thử | Công cụ / Tiêu chuẩn | Số lượng Test Cases | Kết quả thực tế |
| :--- | :--- | :---: | :---: |
| **Backend Unit & API Tests** | Pytest, Pytest-Asyncio, HTTPX | **202 / 202 passed** | **100% ĐẠT** |
| **Frontend Component & Integration** | Vitest, React Testing Library, JSDOM | **140 / 140 passed** (24 suites) | **100% ĐẠT** |
| **Kiểm thử tích hợp Luồng E2E** | TestClient FastAPI + AsyncSession | **Full Flow (Khép kín)** | **100% ĐẠT** |
| **Kiểm thử chuẩn 12 Test Cases SRS** | Postman Collection & Environment | **TC-01 đến TC-12** | **12 / 12 PASS** |
| **Hiệu năng tải bản đồ (10.000 tin)** | Benchmark Script (NFR-PER-01, TC-02) | Target $\le 3000$ ms | **Đạt 4.2 ms** (Vượt chuẩn 700x) |
| **Hiệu năng tìm kiếm từ khóa** | PostgreSQL `pg_trgm` (NFR-PER-02, TC-03)| Target $\le 2000$ ms | **Đạt 24.8 ms** (Vượt chuẩn 80x) |
| **Khả năng sử dụng & Responsive** | Responsive Tester (360px, 768px, 1920px)| Mobile, Tablet, Desktop | **100% Không vỡ layout** |

---

## 6. Danh Sách Hạn Chế Phiên Bản 1.0 & Định Hướng Phát Triển

### 6.1. Hạn chế của Phiên bản 1.0
1. **Lưu trữ ảnh:** Hiện tại ảnh tin đăng tải lên lưu trữ trên hệ thống tệp cục bộ (`uploads/`). Trong môi trường cụm phân tán đa máy chủ (Multi-server), cần tích hợp Object Storage như Amazon S3 hoặc Cloudinary qua `ImageStorageAdapter`.
2. **Kênh trao đổi Người mua - Người bán:** Phiên bản 1.0 tập trung kết nối cuộc gọi qua số điện thoại; chưa tích hợp tính năng Chat thời gian thực (WebSocket).
3. **Thanh toán trực tuyến:** Hệ thống đang hỗ trợ phương thức người mua gặp trực tiếp người bán xem hàng và thanh toán tiền mặt; chưa tích hợp cổng thanh toán trực tuyến ký quỹ (Escrow Payment).

### 6.2. Định hướng Phát triển Phiên bản 2.0
- Tích hợp khung Chat nội bộ thời gian thực bằng FastAPI WebSockets.
- Ứng dụng mô hình AI (Computer Vision) tự động quét ảnh sản phẩm để phát hiện vết xước ngoại quan và hỗ trợ đề xuất điểm tình trạng tự động.
- Nâng cấp hệ thống thông báo đẩy (Push Notifications) khi tin đăng được Admin duyệt hoặc khi có tin rao mới quanh bán kính 2km.
