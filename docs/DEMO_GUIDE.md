# Hướng Dẫn Trải Nghiệm & Thuyết Trình Demo EcoFind

Tài liệu này hướng dẫn chi tiết kịch bản sử dụng bộ dữ liệu mẫu (Demo Dataset) của dự án **EcoFind - Nền tảng Chợ Đồ Cũ Thông Minh theo Vị Trí Bản Đồ & Đánh Giá Tình Trạng**.

---

## 1. Danh Sách Tài Khoản Demo

Hệ thống đã chuẩn bị sẵn 4 tài khoản đại diện cho đầy đủ các vai trò:

| Email | Mật khẩu | Vai trò | Tên hiển thị | Số điện thoại | Kịch bản demo chính |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **`admin@ecofind.vn`** | `Admin@123` | **Quản trị viên** | Quản trị viên Hệ thống | `0900000001` | Duyệt tin chờ duyệt, đối soát 3 điểm tình trạng, hạ điểm, xử lý báo cáo vi phạm. |
| **`seller1@ecofind.vn`** | `Demo@1234` | **Người bán** | Nguyễn Văn Hùng | `0901234567` | Quản lý tin đồ công nghệ (Laptop, bàn phím, tai nghe), sửa tin, ẩn/hiện tin, đánh dấu đã bán. |
| **`seller2@ecofind.vn`** | `Demo@1234` | **Người bán** | Trần Thị Mai | `0912345678` | Quản lý tin đồ gia dụng, nội thất, thời trang, xem tin bị từ chối kèm lý do. |
| **`buyer@ecofind.vn`** | `Demo@1234` | **Người mua** | Lê Hoàng Nam | `0987654321` | Xem 3 tin đã lưu sẵn trong mục Yêu thích, xem số điện thoại người bán, gửi báo cáo vi phạm. |

> [!TIP]
> **Khôi phục / Reset dữ liệu bất cứ lúc nào:**
> Nếu trong quá trình demo bạn thao tác duyệt tin, ẩn tin hoặc xóa dữ liệu và muốn làm mới lại như ban đầu, chỉ cần chạy lệnh:
> ```bash
> .\venv\Scripts\python scripts/seed_demo_listings.py
> ```

---

## 2. Kịch Bản Thuyết Trình / Trải Nghiệm Chi Tiết

### Kịch bản 1: Khách vãng lai khám phá bản đồ đồ cũ quanh mình
1. Mở trang chủ ứng dụng: `http://localhost:5173` (hoặc cổng chạy frontend).
2. **Khám phá Marker 4 màu trên bản đồ:**
   - 🟢 **Xanh lá (Như mới - $\ge 9.0$):** Laptop Dell Latitude (9.1đ), Bàn làm việc gỗ thông (9.0đ), Nồi chiên không dầu (9.4đ)...
   - 🔵 **Xanh dương (Tốt - $7.0 - 8.9$):** Bàn phím cơ AKKO (8.9đ), Tai nghe Sony WH-1000XM4 (8.2đ), Màn hình LG 24 inch (8.0đ)...
   - 🟡 **Vàng cam (Khá - $5.0 - 6.9$):** Chuột Logitech Master 2S (6.0đ), Sofa nỉ phòng khách (6.6đ)...
   - ⚪ **Xám (Cũ - $< 5.0$):** Bàn học mini sinh viên cho tặng 0đ (4.2đ)...
3. **Thử nghiệm Bộ lọc & Tìm kiếm:**
   - Nhập từ khóa: `"laptop"`, `"bàn"`, `"tai nghe"` $\rightarrow$ Danh sách kết quả và marker trên bản đồ tự động lọc theo thời gian thực.
   - Chọn Danh mục: **Đồ điện tử**, **Nội thất**, **Đồ gia dụng**...
   - Kéo chọn khoảng giá hoặc chọn lọc **"Cho tặng miễn phí" ($0$ đ)**.
4. **Xem Chi tiết tin đăng:**
   - Bấm vào một marker trên bản đồ hoặc thẻ tin bên cột trái.
   - Khi chưa đăng nhập: Số điện thoại người bán sẽ được ẩn để bảo mật; có nút nhắc đăng nhập để liên hệ.

---

### Kịch bản 2: Trải nghiệm Người mua (`buyer@ecofind.vn` / `Demo@1234`)
1. Bấm **Đăng nhập** ở góc phải trên cùng $\rightarrow$ Nhập `buyer@ecofind.vn` / `Demo@1234`.
2. **Xem số điện thoại người bán:**
   - Truy cập bất kỳ tin đăng nào $\rightarrow$ Số điện thoại người bán (ví dụ: `0901234567`) hiện đầy đủ kèm nút bấm gọi điện trực tiếp.
3. **Quản lý danh sách Yêu thích:**
   - Bấm vào mục **Yêu thích** trên thanh điều hướng $\rightarrow$ Hiển thị sẵn 3 món đồ đã được lưu trước đó.
   - Thử bấm nút trái tim để bỏ lưu hoặc vào tin khác bấm lưu mới.
4. **Báo cáo tin vi phạm:**
   - Trong trang chi tiết tin đăng, bấm nút **Báo cáo tin vi phạm**.
   - Chọn lý do: *"Hàng giả / Lừa đảo"* hoặc *"Điểm tự chấm không đúng thực tế"* và gửi khiếu nại.

---

### Kịch bản 3: Trải nghiệm Người bán (`seller1@ecofind.vn` / `Demo@1234`)
1. Đăng nhập tài khoản `seller1@ecofind.vn` / `Demo@1234`.
2. Vào mục **Tin của tôi**:
   - **Tab Đang bán:** Xem các món đồ điện tử đang được hiển thị công khai.
   - **Tab Chờ duyệt:** Xem tin *"Máy ảnh cơ Canon EOS M50"* đang chờ quản trị viên phê duyệt.
   - **Tab Bị từ chối:** Xem tin *"iPhone 7 Plus"* kèm thông báo đỏ giải thích lý do quản trị viên từ chối: *"Ảnh chụp màn hình quá tối..."*.
   - **Tab Đã bán:** Xem tin *"AirPods Pro 2"* đã chuyển sang trạng thái bán xong.
3. **Thao tác nhanh trên tin đăng:**
   - Bấm **Ẩn tin** $\rightarrow$ Tin chuyển trạng thái không còn hiển thị trên bản đồ công khai.
   - Bấm **Đánh dấu đã bán** $\rightarrow$ Tin chuyển sang mục đã giao dịch.
   - Bấm **Sửa tin** $\rightarrow$ Cập nhật giá bán, mô tả hoặc điểm tự chấm.
4. **Đăng tin mới:**
   - Bấm nút **Đăng tin bán**.
   - Trải nghiệm bộ tự chấm điểm 3 tiêu chí: *Ngoại quan (40%)*, *Chức năng (40%)*, *Phụ kiện (20%)*. Điểm tổng và xếp hạng cập nhật ngay khi kéo thanh trượt.

---

### Kịch bản 4: Trải nghiệm Quản trị viên (`admin@ecofind.vn` / `Admin@123`)
1. Đăng xuất tài khoản thường và đăng nhập tài khoản Quản trị: `admin@ecofind.vn` / `Admin@123`.
2. Header xuất hiện nút **Quản trị** màu vàng đồng. Bấm vào để vào **Bảng điều khiển Quản trị viên**.
3. **Tab Chờ duyệt (Pending Queue):**
   - Xem 3 tin đăng đang chờ duyệt (Máy ảnh Canon, Tủ quần áo, Bộ tạ tay).
   - Mở xem tin *"Máy ảnh cơ Canon EOS M50"*: Người bán tự chấm Ngoại quan $10/10$.
   - **Demo tính năng Hạ điểm:** Tích chọn *"Hạ điểm thành phần nếu người bán tự chấm cao hơn thực tế"*, hạ điểm Ngoại quan xuống $7.0$ $\rightarrow$ Hệ thống tự động tính lại điểm tổng và phân hạng mới.
   - Bấm **Duyệt tin** $\rightarrow$ Tin được duyệt và xuất hiện ngay lập tức trên bản đồ công khai.
4. **Tab Báo cáo vi phạm (Reports Queue):**
   - Xem 2 báo cáo vi phạm do `buyer@ecofind.vn` gửi lên với lý do khai khống điểm số và nghi vấn thông tin ảo.
   - Bấm xem chi tiết báo cáo $\rightarrow$ Thử thao tác **Ẩn tin vi phạm** hoặc **Bỏ qua báo cáo**.
