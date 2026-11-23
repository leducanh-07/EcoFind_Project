# Bộ Kiểm Thử Postman Tự Động: TC-01 đến TC-12 (Mã task: TE9C758)

Tuân thủ đặc tả kỹ thuật **SDD 8.2** và các yêu cầu chức năng/phi chức năng trong tài liệu **SRS** (UC-01 .. UC-09, FR-02, FR-07, FR-09, FR-12, FR-14, BR-01 .. BR-05, NFR-PER-01, NFR-PER-02, NFR-SEC-01, NFR-SEC-03, NFR-SEC-04).

---

## 1. Danh mục Tệp trong Thư mục `postman/`

1. **`EcoFind_TC01_to_TC12.postman_collection.json`**: Postman Collection (v2.1.0) chứa đầy đủ 12 Test Cases, kịch bản tiền xử lý (`Pre-request Script`), và kịch bản kiểm thử (`Tests`) với các câu lệnh assertion `pm.test(...)`.
2. **`EcoFind.postman_environment.json`**: Postman Environment cấu hình biến môi trường (`baseUrl`, tài khoản mẫu Admin, User A, User B, các biến JWT Token, Listing ID).

---

## 2. Hướng dẫn Chạy Kiểm Thử

### Cách 1: Sử dụng Newman CLI (Chạy tự động từ dòng lệnh)
Cài đặt Newman nếu chưa có:
```bash
npm install -g newman
```
Khởi động máy chủ backend EcoFind tại `http://localhost:8000`:
```powershell
.\venv\Scripts\uvicorn app.main:app --reload
```
Thực thi kiểm thử toàn bộ collection:
```bash
newman run postman/EcoFind_TC01_to_TC12.postman_collection.json -e postman/EcoFind.postman_environment.json --reporters cli
```

### Cách 2: Nhập vào Postman Desktop App
1. Mở ứng dụng **Postman**.
2. Chọn **Import** -> Chọn file `EcoFind_TC01_to_TC12.postman_collection.json` và `EcoFind.postman_environment.json`.
3. Chọn môi trường `EcoFind Environment (Local)` ở góc phải trên.
4. Nhấn chuột phải vào Collection `EcoFind - Test Suite TC-01 đến TC-12` -> chọn **Run collection** -> Nhấn **Run EcoFind**.

---

## 3. Bảng Kết Quả Kiểm Thử (SDD 8.2)

| Mã TC | Use Case | Kịch bản Kiểm Thử | Tiêu chí Chấp Nhận / Kết Quả Mong Đợi | Kết quả | Ghi chú Truy vết |
| :---: | :---: | :--- | :--- | :---: | :--- |
| **TC-01** | UC-01 | Đăng nhập sai mật khẩu 5 lần liên tiếp, sau đó thử lần thứ 6 | Trả về HTTP `423 Locked`; tài khoản bị khóa 15 phút, không thể đăng nhập kể cả với mật khẩu đúng | **ĐẠT (PASS)** | FR-02, NFR-SEC-01 |
| **TC-02** | UC-02 | Tải marker bản đồ qua `GET /api/listings/map` (giả lập mạng 4G) | HTTP `200 OK`; thời gian phản hồi marker đầu tiên $\le$ 3000ms | **ĐẠT (PASS)** | NFR-PER-01, BR-02 |
| **TC-03** | UC-03 | Tìm kiếm và lọc tin đăng với `GET /api/listings?q=bàn` | HTTP `200 OK`; thời gian phản hồi $\le$ 2000ms; trả về $\le$ 50 kết quả mỗi lần | **ĐẠT (PASS)** | NFR-PER-02, FR-05 |
| **TC-04** | UC-04 | Gọi `GET /api/listings/{id}` lần không token và lần có Bearer token | Khi không có token: SĐT bị ẩn (`null`); Khi có token: hiển thị đầy đủ số điện thoại người bán | **ĐẠT (PASS)** | FR-07, UC-04 A1/A2 |
| **TC-05** | UC-05 | Gửi điểm thành phần 9.0, 8.0, 7.0 kèm `totalScore` giả lập 10.0 | Server tự động tính điểm theo trọng số $40\% + 40\% + 20\% = 8.2$, bỏ qua giá trị client gửi lên | **ĐẠT (PASS)** | BR-01, FR-08 |
| **TC-06** | UC-05 | Gửi giá bán âm (`-1`), giá bán vượt 1 tỷ (`1.000.000.001 đ`), ảnh quá 5MB hoặc file GIF | Cả các trường hợp vi phạm đều bị từ chối với HTTP `400 Bad Request` | **ĐẠT (PASS)** | BR-04, BR-05 |
| **TC-07** | UC-05, UC-02 | Đăng tin mới thành công rồi gọi `GET /api/listings?status=selling` | Tin mới ở trạng thái `pending`, không xuất hiện trên bản đồ công khai hoặc kết quả tìm kiếm cho đến khi được duyệt | **ĐẠT (PASS)** | FR-09, BR-03 |
| **TC-08** | UC-06 | Người dùng B gọi `PUT /api/listings/{id}` trên tin đăng của Người dùng A | Trả về HTTP `403 Forbidden`; chỉ chủ sở hữu mới có quyền chỉnh sửa tin của mình | **ĐẠT (PASS)** | NFR-SEC-03, FR-10 |
| **TC-09** | UC-08 | Báo cáo cùng một tin đăng lần thứ 2; hoặc Người dùng tự báo cáo tin của chính mình | Báo cáo tin của chính mình trả `403 Forbidden`; Báo cáo trùng lặp lần 2 trả `409 Conflict` | **ĐẠT (PASS)** | FR-12, UC-08 E1/E3 |
| **TC-10** | UC-09 | Người dùng thường gọi `/api/admin/listings`; sau đó Admin duyệt tin (`/approve`) | Người dùng thường nhận `403 Forbidden`; sau khi Admin duyệt, tin chuyển sang trạng thái `selling` | **ĐẠT (PASS)** | NFR-SEC-03, FR-14 |
| **TC-11** | UC-09 | Admin từ chối tin (`/reject`) mà không nhập lý do bắt buộc | Trả về HTTP `400 Bad Request`; tin đăng giữ nguyên trạng thái không bị thay đổi | **ĐẠT (PASS)** | UC-09 E1, FR-14 |
| **TC-12** | UC-03, UC-05 | Nhập chuỗi `' OR 1=1 --` vào ô tìm kiếm và `<script>` vào ô mô tả | Không gây lỗi SQL cú pháp (HTTP 200 OK); Dữ liệu đầu vào được escape/làm sạch, không chạy mã script | **ĐẠT (PASS)** | NFR-SEC-04 |

---

## 4. Tương ứng với Pytest Backend Suite
Ngoài Postman Collection, toàn bộ 12 ca kiểm thử trên đều có các kiểm thử tự động tương ứng trong bộ unit test của backend (`tests/test_*.py`):
- `tests/test_lockout.py` $\leftrightarrow$ TC-01
- `tests/test_listings_map_api.py` $\leftrightarrow$ TC-02
- `tests/test_listings_search_api.py` $\leftrightarrow$ TC-03, TC-12
- `tests/test_listings_detail_api.py` $\leftrightarrow$ TC-04
- `tests/test_score_calculator.py` & `tests/test_create_listing_api.py` $\leftrightarrow$ TC-05, TC-06, TC-07
- `tests/test_update_listing_api.py` $\leftrightarrow$ TC-08
- `tests/test_report_listing_api.py` $\leftrightarrow$ TC-09
- `tests/test_admin_listings_api.py` & `tests/test_admin_approve_listing_api.py` $\leftrightarrow$ TC-10
- `tests/test_admin_reject_listing_api.py` $\leftrightarrow$ TC-11
- `tests/test_exception_handlers.py` $\leftrightarrow$ NFR-SEC-04
