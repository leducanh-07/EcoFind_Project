#!/usr/bin/env python3
"""
=============================================================================
EcoFind - SecondHand Map Platform
Script: seed_demo_listings.py
Mục đích: Nạp bộ dữ liệu Demo đồ cũ hoàn chỉnh phục vụ kiểm thử, thuyết trình
và đánh giá giao diện/tính năng hệ thống.

Tính năng:
1. Tạo 4 tài khoản chuẩn theo vai trò:
   - Admin: admin@ecofind.vn (Admin@123)
   - Người bán 1: seller1@ecofind.vn (Demo@1234)
   - Người bán 2: seller2@ecofind.vn (Demo@1234)
   - Người mua: buyer@ecofind.vn (Demo@1234)
2. Tạo 35 tin đăng đồ cũ đa dạng 7 danh mục, trải đều 10 quận trung tâm TP.HCM:
   - 28 tin Đang bán (selling): Đủ 4 hạng (Như mới, Tốt, Khá, Cũ) có màu marker
   - 3 tin Chờ duyệt (pending): Phục vụ Admin demo duyệt tin & hạ điểm
   - 2 tin Báo cáo vi phạm (reports): Phục vụ Admin demo xử lý báo cáo
   - 2 tin Bị từ chối (rejected): Phục vụ người bán xem lý do từ chối
   - 2 tin Đã bán (sold): Phục vụ demo trạng thái giao dịch xong
3. Tạo 3 tin lưu Yêu thích sẵn cho tài khoản người mua (buyer@ecofind.vn).
4. Hỗ trợ tùy chọn --clean để xóa dữ liệu demo cũ trước khi nạp lại.
=============================================================================
"""

import sys
import os
import argparse
from datetime import datetime, timezone, timedelta

# Đảm bảo import được các module từ thư mục gốc
ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)

from sqlalchemy import text
from app.core.database import get_engine
from app.core.security import get_password_hash


# =============================================================================
# 1. DANH SÁCH TÀI KHOẢN DEMO
# =============================================================================
DEMO_USERS = [
    {
        "email": "admin@ecofind.vn",
        "full_name": "Quản trị viên Hệ thống",
        "phone": "0900000001",
        "password": "Admin@123",
        "role": "admin",
    },
    {
        "email": "seller1@ecofind.vn",
        "full_name": "Nguyễn Văn Hùng (Chuyên Đồ Công Nghệ)",
        "phone": "0901234567",
        "password": "Demo@1234",
        "role": "user",
    },
    {
        "email": "seller2@ecofind.vn",
        "full_name": "Trần Thị Mai (Thanh Lý Gia Dụng & Nội Thất)",
        "phone": "0912345678",
        "password": "Demo@1234",
        "role": "user",
    },
    {
        "email": "buyer@ecofind.vn",
        "full_name": "Lê Hoàng Nam (Người Mua Sắm)",
        "phone": "0987654321",
        "password": "Demo@1234",
        "role": "user",
    },
]


# =============================================================================
# 2. BỘ DỮ LIỆU 35 TIN ĐĂNG MẪU (7 DANH MỤC, 4 HẠNG CHẤT LƯỢNG)
# =============================================================================
# Category IDs:
# 1: Nội thất, 2: Đồ điện tử, 3: Sách & Văn phòng phẩm, 4: Quần áo & Thời trang
# 5: Đồ gia dụng, 6: Thể thao & Dã ngoại, 7: Mẹ & Bé
# Formula: total_score = round(0.4 * app + 0.4 * fn + 0.2 * acc, 1)

DEMO_LISTINGS = [
    # ------------------ ĐỒ ĐIỆN TỬ (CATEGORY 2) ------------------
    {
        "seller": "seller1",
        "category_id": 2,
        "title": "Laptop Dell Latitude 7490 Core i7 16GB RAM",
        "description": "Máy cá nhân dùng làm việc văn phòng, cấu hình mạnh mẽ i7-8650U, RAM 16GB, SSD NVMe 512GB siêu nhanh. Màn hình 14 inch Full HD chống chói nét căng, pin còn dùng được 3.5 giờ. Kèm sạc Type-C zin theo máy.",
        "price": 6800000,
        "address": "123 Lê Lợi, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
        "lat": 10.7731, "lng": 106.7001,
        "score_app": 9.0, "score_fn": 9.5, "score_acc": 8.5, # 3.6 + 3.8 + 1.7 = 9.1 -> Như mới
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1588872657578-7efd1f1555ed?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller1",
        "category_id": 2,
        "title": "Bàn phím cơ AKKO 3087 v2 Switch Orange",
        "description": "Bàn phím cơ 87 phím gọn gàng, switch Akko Orange tactile gõ êm ái đầm tay. Keycap PBT double-shot chống mòn bóng cực bền. Đầy đủ hộp gốc, nắp che bụi và dây cáp Type-C.",
        "price": 650000,
        "address": "45 Điện Biên Phủ, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh",
        "lat": 10.7915, "lng": 106.6978,
        "score_app": 8.5, "score_fn": 9.0, "score_acc": 9.5, # 3.4 + 3.6 + 1.9 = 8.9 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1618384887929-16ec33fab9ef?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller1",
        "category_id": 2,
        "title": "Tai nghe chống ồn Sony WH-1000XM4 chính hãng",
        "description": "Tai nghe Bluetooth chống ồn chủ động hàng đầu, chất âm chi tiết có bass sâu. Pin dùng thực tế trên 25 tiếng. Ngoại quan có xước nhẹ viền tai nghe nhưng đệm da còn êm, đầy đủ hộp đựng du lịch và cáp sạc.",
        "price": 3400000,
        "address": "285 Cách Mạng Tháng Tám, Phường 12, Quận 10, TP. Hồ Chí Minh",
        "lat": 10.7768, "lng": 106.6782,
        "score_app": 7.5, "score_fn": 9.0, "score_acc": 8.0, # 3.0 + 3.6 + 1.6 = 8.2 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop",
            "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller1",
        "category_id": 2,
        "title": "Màn hình vi tính LG 24 inch 75Hz Full HD IPS",
        "description": "Màn hình văn phòng đồ họa tấm nền IPS màu sắc trung thực, góc nhìn rộng 178 độ, viền mỏng 3 cạnh. Cổng HDMI và VGA hoạt động tốt, không điểm chết hay sọc màn hình.",
        "price": 1450000,
        "address": "72 Nguyễn Trãi, Phường 2, Quận 5, TP. Hồ Chí Minh",
        "lat": 10.7589, "lng": 106.6802,
        "score_app": 8.0, "score_fn": 8.5, "score_acc": 7.0, # 3.2 + 3.4 + 1.4 = 8.0 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller1",
        "category_id": 2,
        "title": "Chuột không dây Logitech Master 2S cũ",
        "description": "Chuột công thái học cao cấp cho dân lập trình và văn phòng. Cuộn vô cực mượt mà, kết nối Bluetooth cùng lúc 3 thiết bị. Lớp cao su ngoài có tróc nhẹ theo thời gian sử dụng nhưng mắt đọc và pin vẫn dùng 1 tháng.",
        "price": 550000,
        "address": "152 Bạch Đằng, Phường 24, Quận Bình Thạnh, TP. Hồ Chí Minh",
        "lat": 10.8032, "lng": 106.7095,
        "score_app": 5.0, "score_fn": 7.5, "score_acc": 5.0, # 2.0 + 3.0 + 1.0 = 6.0 -> Khá
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=800&auto=format&fit=crop",
        ],
    },

    # ------------------ NỘI THẤT (CATEGORY 1) ------------------
    {
        "seller": "seller2",
        "category_id": 1,
        "title": "Bàn làm việc gỗ thông tự nhiên 1m2 x 60cm",
        "description": "Bàn làm việc đóng bằng gỗ thông tự nhiên dày 2cm, khung chân sắt sơn tĩnh điện chịu lực 80kg. Bề mặt phủ PU bóng chống thấm nước, không mối mọt cong vênh. Dọn nhà cần thanh lý gấp.",
        "price": 750000,
        "address": "88 Huỳnh Văn Bánh, Phường 15, Quận Phú Nhuận, TP. Hồ Chí Minh",
        "lat": 10.7938, "lng": 106.6775,
        "score_app": 9.0, "score_fn": 9.5, "score_acc": 8.0, # 3.6 + 3.8 + 1.6 = 9.0 -> Như mới
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller2",
        "category_id": 1,
        "title": "Ghế công thái học Ergonomic Sihoo M57",
        "description": "Ghế xoay lưới toàn phần thoáng khí, đỡ thắt lưng điều chỉnh đa chiều giúp chống đau lưng khi ngồi lâu. Tay vịn 3D, chân nhôm đúc sáng bóng, bánh xe PU lướt êm không trầy sàn gỗ.",
        "price": 2100000,
        "address": "104 Hoàng Văn Thụ, Phường 9, Quận Phú Nhuận, TP. Hồ Chí Minh",
        "lat": 10.8005, "lng": 106.6741,
        "score_app": 8.5, "score_fn": 9.0, "score_acc": 8.5, # 3.4 + 3.6 + 1.7 = 8.7 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1580481077195-c228ff31a939?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller2",
        "category_id": 1,
        "title": "Kệ sách gỗ 5 tầng đứng cao 1m5",
        "description": "Kệ sách gỗ công nghiệp MDF lõi xanh chống ẩm, màu vân sồi Bắc Âu trang nhã. Các tầng chắc chắn để được nhiều sách và đồ decor. Kệ còn nguyên vẹn, không xước mép.",
        "price": 380000,
        "address": "56 Nguyễn Thị Minh Khai, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh",
        "lat": 10.7854, "lng": 106.6975,
        "score_app": 8.0, "score_fn": 8.0, "score_acc": 7.0, # 3.2 + 3.2 + 1.4 = 7.8 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1594980596870-8aa52a78d8cd?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller2",
        "category_id": 1,
        "title": "Sofa nỉ văng 2 chỗ ngồi màu ghi xám",
        "description": "Sofa vải nỉ phòng khách nhỏ gọn dài 1m6, đệm mút D40 êm ái đàn hồi tốt. Vải bọc đã giặt sấy thơm tho sạch sẽ, có vài vết sờn chỉ nhẹ ở góc khuất, chân gỗ tự nhiên.",
        "price": 1200000,
        "address": "320 Xô Viết Nghệ Tĩnh, Phường 25, Quận Bình Thạnh, TP. Hồ Chí Minh",
        "lat": 10.8082, "lng": 106.7118,
        "score_app": 6.5, "score_fn": 7.0, "score_acc": 6.0, # 2.6 + 2.8 + 1.2 = 6.6 -> Khá
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller2",
        "category_id": 1,
        "title": "Bàn học gấp mini cho sinh viên (Cho tặng miễn phí)",
        "description": "Bàn học sinh viên xếp gọn bằng chân sắt, mặt bàn ép gỗ có xước nhiều và mòn góc nhưng khung chân vẫn đứng vững. Tặng miễn phí cho bạn sinh viên nào cần.",
        "price": 0,
        "address": "180 Ung Văn Khiêm, Phường 25, Quận Bình Thạnh, TP. Hồ Chí Minh",
        "lat": 10.8095, "lng": 106.7162,
        "score_app": 3.5, "score_fn": 5.0, "score_acc": 4.0, # 1.4 + 2.0 + 0.8 = 4.2 -> Cũ
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&auto=format&fit=crop",
        ],
    },

    # ------------------ ĐỒ GIA DỤNG (CATEGORY 5) ------------------
    {
        "seller": "seller2",
        "category_id": 5,
        "title": "Nồi chiên không dầu Philips HD9252 dung tích 4.1L",
        "description": "Nồi chiên điện tử công nghệ Rapid Air giòn rụm không dầu mỡ, màn hình cảm ứng 7 chế độ cài đặt sẵn. Lớp chống dính lòng nồi còn nguyên chưa tróc, dùng cực kỳ êm và tiết kiệm điện.",
        "price": 1250000,
        "address": "15 Nguyễn Thông, Phường 9, Quận 3, TP. Hồ Chí Minh",
        "lat": 10.7774, "lng": 106.6811,
        "score_app": 9.5, "score_fn": 9.5, "score_acc": 9.0, # 3.8 + 3.8 + 1.8 = 9.4 -> Như mới
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller2",
        "category_id": 5,
        "title": "Nồi cơm điện Cuckoo CR-0661F 1.08L Hàn Quốc",
        "description": "Nồi cơm điện cơ dung tích 1L nấu cơm cho gia đình 2-4 người. Lòng nồi dày dặn phủ men chống dính cao cấp xịn sò, giữ ấm cơm cả ngày không bị thiu, nấu nhanh và cơm dẻo.",
        "price": 550000,
        "address": "402 Hai Bà Trưng, Phường Tân Định, Quận 1, TP. Hồ Chí Minh",
        "lat": 10.7905, "lng": 106.6908,
        "score_app": 8.0, "score_fn": 8.5, "score_acc": 8.0, # 3.2 + 3.4 + 1.6 = 8.2 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller2",
        "category_id": 5,
        "title": "Quạt đứng lỡ Senko L1638 động cơ bạc thau",
        "description": "Quạt cây lỡ Senko 3 tốc độ gió, túp năng chuyển hướng gió đều khắp phòng. Cánh quạt 40cm cam trong suốt, lồng quạt chắc chắn an toàn cho trẻ nhỏ. Động cơ êm ru không rung lắc.",
        "price": 180000,
        "address": "68 Lý Thường Kiệt, Phường 7, Quận Tân Bình, TP. Hồ Chí Minh",
        "lat": 10.7882, "lng": 106.6575,
        "score_app": 7.0, "score_fn": 8.0, "score_acc": 6.5, # 2.8 + 3.2 + 1.3 = 7.3 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller2",
        "category_id": 5,
        "title": "Máy xay sinh tố Tefal Blendforce 2 cối thủy tinh",
        "description": "Máy xay sinh tố công suất 600W lưỡi dao 6 cánh sắc bén xay được cả đá bi nhỏ. Cối thủy tinh lớn 1.75L và cối nhỏ xay thịt khô. Thân máy có vài vết trầy mờ bên hông nhưng motor chạy rất khỏe.",
        "price": 420000,
        "address": "250 Quang Trung, Phường 10, Quận Gò Vấp, TP. Hồ Chí Minh",
        "lat": 10.8351, "lng": 106.6668,
        "score_app": 6.0, "score_fn": 7.0, "score_acc": 6.0, # 2.4 + 2.8 + 1.2 = 6.4 -> Khá
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller2",
        "category_id": 5,
        "title": "Ấm đun nước siêu tốc inox Lock&Lock 1.8L",
        "description": "Ấm đun siêu tốc inox 304 hai lớp cách nhiệt, đun sôi trong vòng 4 phút tự ngắt an toàn. Rơ-le hoạt động bình thường, đáy ấm có đọng cặn vôi nhẹ nhưng cọ rửa sạch sẽ là dùng tốt.",
        "price": 95000,
        "address": "120 Nguyễn Oanh, Phường 7, Quận Gò Vấp, TP. Hồ Chí Minh",
        "lat": 10.8398, "lng": 106.6745,
        "score_app": 4.5, "score_fn": 6.0, "score_acc": 4.0, # 1.8 + 2.4 + 0.8 = 5.0 -> Khá
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1544233726-9f1d2b27be8b?w=800&auto=format&fit=crop",
        ],
    },

    # ------------------ SÁCH & VĂN PHÒNG PHẨM (CATEGORY 3) ------------------
    {
        "seller": "seller1",
        "category_id": 3,
        "title": "Bộ sách Tâm lý học: Đắc Nhân Tâm & Nghĩ Giàu Làm Giàu",
        "description": "Hai cuốn sách kinh điển bản in bìa mềm của First News, giấy xốp chống lóa mắt đọc êm. Sách giữ rất kỹ, gáy sách nguyên vẹn không quăn mép hay gãy gập, không bị vẽ bậy hay note bút dạ.",
        "price": 95000,
        "address": "227 Nguyễn Văn Cừ, Phường 4, Quận 5, TP. Hồ Chí Minh",
        "lat": 10.7628, "lng": 106.6825,
        "score_app": 9.5, "score_fn": 9.5, "score_acc": 9.0, # 9.4 -> Như mới
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller1",
        "category_id": 3,
        "title": "Combo 20 cuốn truyện tranh Thám tử lừng danh Conan (Tập 60 - 80)",
        "description": "Truyện tranh NXB Kim Đồng bản in chính hãng, truyện của em trai đọc xong cất tủ kính. Giấy còn vàng tự nhiên, gáy truyện chắc chắn không bung trang hay rách bìa.",
        "price": 240000,
        "address": "140 Trần Hưng Đạo, Phường 7, Quận 5, TP. Hồ Chí Minh",
        "lat": 10.7551, "lng": 106.6702,
        "score_app": 8.0, "score_fn": 8.5, "score_acc": 8.0, # 8.2 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1532012164546-f432f2e37b73?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller1",
        "category_id": 3,
        "title": "Bộ sách giáo khoa lớp 10 chương trình mới (Cho tặng miễn phí)",
        "description": "Trọn bộ SGK Kết Nối Tri Thức lớp 10 gồm Toán, Ngữ Văn, Tiếng Anh, Vật Lý, Hóa Học... Đã bao bìa cẩn thận, có ghi chú bút chì vài bài học. Tặng bạn học sinh nào gia đình khó khăn cần dùng.",
        "price": 0,
        "address": "52 Võ Văn Ngân, Phường Linh Chiểu, TP. Thủ Đức, TP. Hồ Chí Minh",
        "lat": 10.8512, "lng": 106.7621,
        "score_app": 7.0, "score_fn": 8.5, "score_acc": 7.0, # 7.6 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller1",
        "category_id": 3,
        "title": "Từ điển Anh - Việt 150.000 từ bìa cứng dày 1200 trang",
        "description": "Từ điển NXB Khoa Học Xã Hội bản bìa mạ vàng trang trọng. Bìa ngoài có sờn nhẹ ở góc do để kệ lâu năm, ruột giấy vàng cổ điển nhưng rõ chữ tra cứu tốt.",
        "price": 80000,
        "address": "12 Kha Vạn Cân, Phường Hiệp Bình Chánh, TP. Thủ Đức, TP. Hồ Chí Minh",
        "lat": 10.8354, "lng": 106.7265,
        "score_app": 5.5, "score_fn": 7.0, "score_acc": 5.0, # 6.0 -> Khá
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1457369804613-52c61a468e7d?w=800&auto=format&fit=crop",
        ],
    },

    # ------------------ QUẦN ÁO & THỜI TRANG (CATEGORY 4) ------------------
    {
        "seller": "seller2",
        "category_id": 4,
        "title": "Áo khoác gió thể thao Uniqlo Blocktech size L chống nước",
        "description": "Áo gió công nghệ Blocktech chống gió và cản nước nhẹ, màu xanh navy sang trọng nam tính. Mua đi du lịch Sapa 1 lần rồi giặt hấp treo tủ, ngoại quan gần như mới 98%, khóa kéo mượt.",
        "price": 520000,
        "address": "115 Nguyễn Đình Chiểu, Phường 6, Quận 3, TP. Hồ Chí Minh",
        "lat": 10.7812, "lng": 106.6914,
        "score_app": 9.5, "score_fn": 9.5, "score_acc": 8.5, # 9.3 -> Như mới
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1544441893-675973e31985?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller2",
        "category_id": 4,
        "title": "Quần jeans nam Levi's 511 Slim Fit chính hãng size 31",
        "description": "Quần jean vải bò dày dặn co giãn nhẹ, wash màu xanh chàm cổ điển cực tôn dáng. Đường kim mũi chỉ nguyên bản chưa qua cắt gấu hay sửa size, khuy đồng dập chìm chuẩn xịn.",
        "price": 600000,
        "address": "48 Nguyễn Trãi, Phường Bến Thành, Quận 1, TP. Hồ Chí Minh",
        "lat": 10.7698, "lng": 106.6912,
        "score_app": 8.5, "score_fn": 8.5, "score_acc": 8.0, # 8.4 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1542272604-780c96856592?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller2",
        "category_id": 4,
        "title": "Balo laptop The North Face Surge II 32L chống sốc",
        "description": "Balo phượt và văn phòng dung tích lớn, ngăn đựng laptop 15.6 inch lót nhung chống sốc cực dày. Đệm lưng Airmesh thoáng khí đỡ mỏi vai. Có xước nhẹ quai xách nhưng khóa YKK bền vĩnh cửu.",
        "price": 450000,
        "address": "384 Cộng Hòa, Phường 13, Quận Tân Bình, TP. Hồ Chí Minh",
        "lat": 10.8035, "lng": 106.6432,
        "score_app": 7.0, "score_fn": 8.0, "score_acc": 7.0, # 7.4 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller2",
        "category_id": 4,
        "title": "Giày thể thao Nike Air Max size 42 cũ",
        "description": "Giày tập gym và chạy bộ, đế đệm khí Air Max đàn hồi êm chân. Phần đế cao su có mòn gót nhẹ, vải lót bên trong xù lông tự nhiên nhưng vải lưới ngoài không rách gãy.",
        "price": 350000,
        "address": "210 Trường Chinh, Phường 13, Quận Tân Bình, TP. Hồ Chí Minh",
        "lat": 10.7981, "lng": 106.6468,
        "score_app": 5.0, "score_fn": 6.5, "score_acc": 5.0, # 5.6 -> Khá
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=800&auto=format&fit=crop",
        ],
    },

    # ------------------ THỂ THAO & DÃ NGOẠI (CATEGORY 6) ------------------
    {
        "seller": "seller1",
        "category_id": 6,
        "title": "Xe đạp địa hình Asama Cross LX 26 inch khung nhôm",
        "description": "Xe đạp thể thao touring khung hợp kim nhôm 6061 siêu nhẹ không rỉ, bộ đề líp Shimano 21 tốc độ chuyển số êm mượt. Thắng đĩa trước sau ăn chắc, lốp xe Kenda còn gai dầy bám đường tốt.",
        "price": 2400000,
        "address": "18 Nguyễn Hữu Cảnh, Phường 22, Quận Bình Thạnh, TP. Hồ Chí Minh",
        "lat": 10.7925, "lng": 106.7145,
        "score_app": 8.5, "score_fn": 9.0, "score_acc": 8.5, # 8.7 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller1",
        "category_id": 6,
        "title": "Vợt cầu lông Yonex Astrox 77 Play 4U đã đan cước",
        "description": "Vợt cầu lông chuyên công thủ toàn diện, thân vợt dẻo trợ lực tốt cho người chơi phong trào. Đã căng sẵn cước Yonex BG65 10.5kg còn nảy, cán vợt đã quấn cốt êm tay, kèm bao vợt đơn.",
        "price": 750000,
        "address": "90 Ba Tháng Hai, Phường 14, Quận 10, TP. Hồ Chí Minh",
        "lat": 10.7685, "lng": 106.6632,
        "score_app": 8.0, "score_fn": 9.0, "score_acc": 8.0, # 8.4 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller1",
        "category_id": 6,
        "title": "Lều cắm trại du lịch 4 người tự bung chống mưa Naturehike",
        "description": "Lều phượt tự bung mở nhanh trong 30 giây bằng cơ chế lò xo thủy lực. Vải lều 210D Oxford phủ lớp PU chống thấm nước 3000mm, có 2 cửa sổ lưới thông gió chống muỗi. Đủ cọc ghim và dây chằng gió.",
        "price": 680000,
        "address": "450 Huỳnh Tấn Phát, Phường Bình Thuận, Quận 7, TP. Hồ Chí Minh",
        "lat": 10.7421, "lng": 106.7289,
        "score_app": 8.5, "score_fn": 8.5, "score_acc": 9.0, # 8.6 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1504280390367-361c6d9f38f4?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller1",
        "category_id": 6,
        "title": "Thảm tập Yoga TPE 6mm định tuyến chống trượt",
        "description": "Thảm tập cao su non TPE 2 lớp dày 6mm êm gối, có vạch định tuyến giúp canh chuẩn tư thế Asana. Mặt thảm hoa văn bám sàn tốt, đã lau cồn vệ sinh sạch sẽ, có túi đeo lưới kèm theo.",
        "price": 120000,
        "address": "15 Nguyễn Thị Thập, Phường Tân Phú, Quận 7, TP. Hồ Chí Minh",
        "lat": 10.7385, "lng": 106.7152,
        "score_app": 7.0, "score_fn": 8.0, "score_acc": 7.0, # 7.4 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=800&auto=format&fit=crop",
        ],
    },

    # ------------------ MẸ & BÉ (CATEGORY 7) ------------------
    {
        "seller": "seller2",
        "category_id": 7,
        "title": "Xe đẩy trẻ em du lịch siêu gọn Aprica Nhật Bản 2 chiều",
        "description": "Xe đẩy cho bé từ 0-3 tuổi, khung xe đúc nhôm siêu nhẹ chỉ 3.8kg gập gọn một chạm bằng tay xách. Đệm lót 3D thoáng khí thấm hút mồ hôi, mái che chống tia UV 99%, 4 bánh xoay 360 độ êm ái.",
        "price": 1650000,
        "address": "78 Nam Kỳ Khởi Nghĩa, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
        "lat": 10.7745, "lng": 106.7012,
        "score_app": 9.0, "score_fn": 9.5, "score_acc": 9.0, # 9.2 -> Như mới
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller2",
        "category_id": 7,
        "title": "Ghế ăn dặm cho bé Mastela điều chỉnh 3 độ cao",
        "description": "Ghế ăn dặm bằng nhựa PP an toàn không BPA, khay ăn tháo rời vệ sinh nhanh chóng. Có đai an toàn 3 điểm giữ bé ngồi vững vàng, chân ghế bọc cao su chống trơn trượt gấp gọn mang đi du lịch.",
        "price": 280000,
        "address": "125 Lê Văn Sỹ, Phường 13, Quận 3, TP. Hồ Chí Minh",
        "lat": 10.7892, "lng": 106.6788,
        "score_app": 8.0, "score_fn": 8.5, "score_acc": 7.5, # 8.1 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1596461404969-9ae70f2830c1?w=800&auto=format&fit=crop",
        ],
    },

    # ------------------ KHU VỰC TP. THỦ ĐỨC & QUẬN 9 (PHƯỚC LONG & TĂNG NHƠN PHÚ) ------------------
    {
        "seller": "seller1",
        "category_id": 2,
        "title": "Bàn phím cơ DareU EK87 Tenkeyless Switch Blue",
        "description": "Bàn phím cơ DareU EK87 bản switch D-Blue tiếng gõ clicky vui tai, layout 87 phím nhỏ gọn cho sinh viên. Đèn LED đỏ đơn sắc còn sáng đều, keycap không phai chữ, dây bọc dù chống đứt gãy.",
        "price": 320000,
        "address": "450 Đỗ Xuân Hợp, Phường Phước Long B, TP. Thủ Đức, TP. Hồ Chí Minh",
        "lat": 10.8285, "lng": 106.7725,
        "score_app": 8.5, "score_fn": 9.0, "score_acc": 8.5, # 8.7 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller1",
        "category_id": 2,
        "title": "Laptop Asus Vivobook 15 Core i5 8GB RAM",
        "description": "Laptop Asus mỏng nhẹ màn hình 15.6 inch viền mỏng NanoEdge, bàn phím số phụ tiện nhập liệu. Máy dùng mượt mà tác vụ Word, Excel, Photoshop cơ bản. Pin 3 tiếng, sạc zin theo máy.",
        "price": 5200000,
        "address": "120 Lê Văn Việt, Phường Hiệp Phú, TP. Thủ Đức, TP. Hồ Chí Minh",
        "lat": 10.8445, "lng": 106.7782,
        "score_app": 8.5, "score_fn": 9.0, "score_acc": 8.0, # 8.6 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller2",
        "category_id": 1,
        "title": "Bàn làm việc chân sắt chữ K mặt gỗ MDF 1m",
        "description": "Bàn học sinh viên mặt bàn phủ melamine vân gỗ chống trầy, chân sắt sơn đen chịu lực tốt. Có khay để cốc nước và móc treo tai nghe. Để lại giá rẻ cho bạn nào ở trọ gần Cao Đẳng Công Thương.",
        "price": 290000,
        "address": "88 Tăng Nhơn Phú, Phường Phước Long B, TP. Thủ Đức, TP. Hồ Chí Minh",
        "lat": 10.8315, "lng": 106.7695,
        "score_app": 8.0, "score_fn": 8.5, "score_acc": 7.5, # 8.1 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller1",
        "category_id": 2,
        "title": "Tai nghe Bluetooth Marshall Major IV pin 80h",
        "description": "Tai nghe chụp tai phong cách cổ điển Marshall, nút joystick điều khiển đa năng. Pin dùng liên tục tới 80 tiếng, có sạc nhanh Type-C và sạc không dây. Ngoại quan đẹp, đệm tai mềm mại.",
        "price": 1850000,
        "address": "15 Man Thiện, Phường Hiệp Phú, TP. Thủ Đức, TP. Hồ Chí Minh",
        "lat": 10.8465, "lng": 106.7815,
        "score_app": 9.0, "score_fn": 9.5, "score_acc": 9.0, # 9.2 -> Như mới
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller2",
        "category_id": 5,
        "title": "Nồi chiên không dầu Lock&Lock EJF357BLK 5.2L",
        "description": "Nồi chiên dung tích lớn 5.2L chiên vừa cả con gà 1.8kg. Bảng điều khiển cảm ứng điện tử hiện đại, lòng nồi tháo rời chống dính sạch sẽ dễ cọ rửa. Máy hoạt động hoàn hảo.",
        "price": 950000,
        "address": "35 Đặng Văn Bi, Phường Bình Thọ, TP. Thủ Đức, TP. Hồ Chí Minh",
        "lat": 10.8415, "lng": 106.7612,
        "score_app": 8.5, "score_fn": 9.0, "score_acc": 8.0, # 8.6 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller1",
        "category_id": 6,
        "title": "Vợt cầu lông Proace Stroke 318 đan cước 10kg",
        "description": "Dòng vợt thân dẻo dễ thuần cho người mới chơi hoặc học sinh sinh viên. Khung vợt cân bằng, trợ lực tốt, đã quấn cán Yonex mới tinh kèm túi đựng.",
        "price": 380000,
        "address": "24 Tây Hòa, Phường Phước Long A, TP. Thủ Đức, TP. Hồ Chí Minh",
        "lat": 10.8215, "lng": 106.7645,
        "score_app": 8.0, "score_fn": 8.5, "score_acc": 8.0, # 8.2 -> Tốt
        "status": "selling",
        "photos": [
            "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800&auto=format&fit=crop",
        ],
    },

    # ------------------ TIN CHỜ DUYỆT (PENDING - DEMO ADMIN APPROVE/DOWN-SCORE) ------------------
    {
        "seller": "seller1",
        "category_id": 2,
        "title": "Máy ảnh cơ Canon EOS M50 kèm ống kính kit 15-45mm",
        "description": "Máy ảnh mirrorless quay video 4K, màn hình lật xoay cảm ứng tiện lợi cho làm vlog. Ngoại quan máy có xước nhẹ viền ống kính và nắp pin hơi lỏng, nhưng người bán tự chấm điểm ngoại quan 10/10 (Admin có thể hạ điểm khi kiểm duyệt).",
        "price": 8500000,
        "address": "12 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP. Hồ Chí Minh",
        "lat": 10.7725, "lng": 106.7042,
        "score_app": 10.0, "score_fn": 9.0, "score_acc": 9.0, # Tự chấm 9.4 -> Admin có thể hạ xuống 7.5
        "status": "pending",
        "photos": [
            "https://images.unsplash.com/photo-1516035069371-29a1b244cc32?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller2",
        "category_id": 1,
        "title": "Tủ quần áo gỗ ép 3 cánh lùa rộng 1m4",
        "description": "Tủ quần áo lớn gia đình dọn sang nhà mới cần thanh lý. Tủ tháo lắp dễ dàng, cánh lùa trượt trơn tru, gương soi trong sáng đẹp. Đang gửi ban quản trị kiểm duyệt tin.",
        "price": 1400000,
        "address": "55 Phan Đăng Lưu, Phường 7, Quận Phú Nhuận, TP. Hồ Chí Minh",
        "lat": 10.8021, "lng": 106.6895,
        "score_app": 8.0, "score_fn": 8.5, "score_acc": 8.0,
        "status": "pending",
        "photos": [
            "https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller1",
        "category_id": 6,
        "title": "Bộ tạ tay đa năng điều chỉnh 20kg kèm thanh đòn",
        "description": "Bộ tạ đĩa gang bọc cao su gồm 4 bánh 2.5kg, 4 bánh 1.25kg, 4 bánh 0.5kg và thanh nối dài thành tạ đòn gánh squat. Tập tại nhà mùa mưa tiện lợi, chốt khóa an toàn.",
        "price": 500000,
        "address": "330 Võ Văn Kiệt, Phường Cô Giang, Quận 1, TP. Hồ Chí Minh",
        "lat": 10.7612, "lng": 106.6958,
        "score_app": 8.5, "score_fn": 9.0, "score_acc": 8.5,
        "status": "pending",
        "photos": [
            "https://images.unsplash.com/photo-1584735935682-2f2b69dff9d2?w=800&auto=format&fit=crop",
        ],
    },

    # ------------------ TIN BỊ TỪ CHỐI (REJECTED - DEMO MY LISTINGS TAB) ------------------
    {
        "seller": "seller1",
        "category_id": 2,
        "title": "Điện thoại iPhone 7 Plus 128GB đỏ bản quốc tế",
        "description": "Máy thanh lý giá rẻ, ngoại quan trầy góc nhiều. Bị quản trị viên từ chối do ảnh chụp góc khuất không rõ tem niêm phong và màn hình tối màu.",
        "price": 1800000,
        "address": "95 Nguyễn Trãi, Phường 2, Quận 5, TP. Hồ Chí Minh",
        "lat": 10.7575, "lng": 106.6782,
        "score_app": 5.0, "score_fn": 7.0, "score_acc": 5.0,
        "status": "rejected",
        "reject_reason": "Ảnh chụp màn hình quá tối và không thấy rõ tình trạng sườn máy. Vui lòng chụp lại ảnh nơi đủ sáng.",
        "photos": [
            "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller2",
        "category_id": 4,
        "title": "Áo khoác da bò biker jacket nam size XL",
        "description": "Áo khoác da thật dáng biker phong trần. Bị từ chối kiểm duyệt do thiếu ảnh chụp lớp lót bên trong và nhãn mác thương hiệu.",
        "price": 850000,
        "address": "74 Phan Xích Long, Phường 2, Quận Phú Nhuận, TP. Hồ Chí Minh",
        "lat": 10.7965, "lng": 106.6921,
        "score_app": 6.0, "score_fn": 7.5, "score_acc": 6.0,
        "status": "rejected",
        "reject_reason": "Sản phẩm thời trang cao cấp cần bổ sung ảnh chụp tem mác và lớp lót bên trong theo quy chế cộng đồng.",
        "photos": [
            "https://images.unsplash.com/photo-1521223890158-f9f7c3d5d504?w=800&auto=format&fit=crop",
        ],
    },

    # ------------------ TIN ĐÃ BÁN (SOLD - DEMO MY LISTINGS TAB) ------------------
    {
        "seller": "seller1",
        "category_id": 2,
        "title": "Tai nghe AirPods Pro 2 chính hãng sạc Type-C",
        "description": "Đã giao dịch thành công cho một bạn sinh viên Đại học Bách Khoa TP.HCM. Cảm ơn EcoFind kết nối!",
        "price": 3200000,
        "address": "268 Lý Thường Kiệt, Phường 14, Quận 10, TP. Hồ Chí Minh",
        "lat": 10.7725, "lng": 106.6578,
        "score_app": 9.5, "score_fn": 9.5, "score_acc": 9.0,
        "status": "sold",
        "photos": [
            "https://images.unsplash.com/photo-1600294037681-c80b4cb5b434?w=800&auto=format&fit=crop",
        ],
    },
    {
        "seller": "seller2",
        "category_id": 1,
        "title": "Gương toàn thân khung gỗ thông có bánh xe di chuyển",
        "description": "Gương soi đứng toàn thân đã bán cho bạn gái ở Tân Bình. Trạng thái đã chuyển sang Đã bán.",
        "price": 280000,
        "address": "85 Hoàng Hoa Thám, Phường 13, Quận Tân Bình, TP. Hồ Chí Minh",
        "lat": 10.8021, "lng": 106.6492,
        "score_app": 8.5, "score_fn": 9.0, "score_acc": 8.5,
        "status": "sold",
        "photos": [
            "https://images.unsplash.com/photo-1618221195710-dd6b41faaea6?w=800&auto=format&fit=crop",
        ],
    },
]


def seed_demo(clean: bool = True):
    """Thực thi chèn dữ liệu demo vào cơ sở dữ liệu."""
    engine = get_engine()

    print("==================================================================")
    print("        ECOFIND - NẠP BỘ DỮ LIỆU DEMO THỰC TẾ (SEED DEMO)         ")
    print("==================================================================")

    with engine.begin() as conn:
        # 1. Dọn dẹp dữ liệu cũ nếu bật cờ --clean
        if clean:
            print("\n[1/5] Đang dọn dẹp dữ liệu demo cũ...")
            # Lấy danh sách email demo
            demo_emails = [u["email"] for u in DEMO_USERS]
            email_placeholders = ", ".join(f"'{e}'" for e in demo_emails)

            # Xóa các reports, favorites, photos và listings liên quan đến các user demo
            conn.execute(text(f"""
                DELETE FROM reports WHERE reporter_id IN (
                    SELECT user_id FROM users WHERE email IN ({email_placeholders})
                );
            """))
            conn.execute(text(f"""
                DELETE FROM favorites WHERE user_id IN (
                    SELECT user_id FROM users WHERE email IN ({email_placeholders})
                );
            """))
            conn.execute(text(f"""
                DELETE FROM listing_photos WHERE listing_id IN (
                    SELECT listing_id FROM listings WHERE seller_id IN (
                        SELECT user_id FROM users WHERE email IN ({email_placeholders})
                    )
                );
            """))
            conn.execute(text(f"""
                DELETE FROM listings WHERE seller_id IN (
                    SELECT user_id FROM users WHERE email IN ({email_placeholders})
                );
            """))
            print("  -> Đã xóa sạch tin đăng và dữ liệu giao dịch cũ của các tài khoản demo.")

        # 2. Tạo hoặc cập nhật tài khoản demo
        print("\n[2/5] Đang tạo / cập nhật 4 tài khoản demo...")
        user_ids = {}
        for u in DEMO_USERS:
            # Kiểm tra xem user đã tồn tại chưa
            existing = conn.execute(
                text("SELECT user_id FROM users WHERE email = :email"),
                {"email": u["email"]}
            ).fetchone()

            p_hash = get_password_hash(u["password"])

            if existing:
                uid = existing[0]
                conn.execute(
                    text("""
                        UPDATE users
                        SET full_name = :full_name, phone = :phone, password_hash = :p_hash, role = :role
                        WHERE user_id = :uid
                    """),
                    {
                        "full_name": u["full_name"],
                        "phone": u["phone"],
                        "p_hash": p_hash,
                        "role": u["role"],
                        "uid": uid,
                    }
                )
                print(f"  ✓ Cập nhật tài khoản: {u['email']} (ID: {uid}, Role: {u['role']})")
            else:
                res = conn.execute(
                    text("""
                        INSERT INTO users (full_name, email, phone, password_hash, role)
                        VALUES (:full_name, :email, :phone, :p_hash, :role)
                        RETURNING user_id
                    """),
                    {
                        "full_name": u["full_name"],
                        "email": u["email"],
                        "phone": u["phone"],
                        "p_hash": p_hash,
                        "role": u["role"],
                    }
                ).fetchone()
                uid = res[0]
                print(f"  ✓ Tạo mới tài khoản: {u['email']} (ID: {uid}, Role: {u['role']})")

            user_ids[u["email"]] = uid

        # 3. Tạo tin đăng mẫu (Listings & Photos)
        print("\n[3/5] Đang tạo 35 tin đăng mẫu cùng ảnh thực tế...")
        inserted_listing_ids = []
        now = datetime.now(timezone.utc)

        for idx, item in enumerate(DEMO_LISTINGS, 1):
            seller_key = item["seller"]
            seller_email = f"{seller_key}@ecofind.vn"
            seller_id = user_ids.get(seller_email) or user_ids["seller1@ecofind.vn"]

            app_score = float(item["score_app"])
            fn_score = float(item["score_fn"])
            acc_score = float(item["score_acc"])
            total_score = round(0.4 * app_score + 0.4 * fn_score + 0.2 * acc_score, 1)

            # Lùi thời gian một chút cho tin cũ hơn
            created_at = now - timedelta(hours=idx * 2)

            res = conn.execute(
                text("""
                    INSERT INTO listings (
                        seller_id, category_id, title, description, price, address,
                        lat, lng, score_appearance, score_function, score_accessories,
                        total_score, status, reject_reason, hidden_by_admin, created_at
                    ) VALUES (
                        :seller_id, :category_id, :title, :description, :price, :address,
                        :lat, :lng, :score_app, :score_fn, :score_acc,
                        :total_score, :status, :reject_reason, false, :created_at
                    )
                    RETURNING listing_id
                """),
                {
                    "seller_id": seller_id,
                    "category_id": item["category_id"],
                    "title": item["title"],
                    "description": item["description"],
                    "price": item["price"],
                    "address": item["address"],
                    "lat": item["lat"],
                    "lng": item["lng"],
                    "score_app": app_score,
                    "score_fn": fn_score,
                    "score_acc": acc_score,
                    "total_score": total_score,
                    "status": item["status"],
                    "reject_reason": item.get("reject_reason"),
                    "created_at": created_at,
                }
            ).fetchone()

            lid = res[0]
            inserted_listing_ids.append((lid, item))

            # Chèn ảnh sản phẩm
            for sort_order, p_url in enumerate(item.get("photos", [])):
                conn.execute(
                    text("""
                        INSERT INTO listing_photos (listing_id, url, sort_order)
                        VALUES (:lid, :url, :sort_order)
                    """),
                    {"lid": lid, "url": p_url, "sort_order": sort_order}
                )

        print(f"  ✓ Đã chèn thành công {len(inserted_listing_ids)} tin đăng kèm ảnh CDN Unsplash.")

        # 4. Tạo báo cáo vi phạm mẫu (Reports) cho Admin demo
        print("\n[4/5] Đang tạo 2 báo cáo vi phạm mẫu để demo Admin...")
        buyer_id = user_ids["buyer@ecofind.vn"]

        # Chọn 2 tin đang bán để tạo báo cáo vi phạm
        selling_listings = [lid for (lid, item) in inserted_listing_ids if item["status"] == "selling"]
        if len(selling_listings) >= 2:
            rep_lid_1 = selling_listings[0]
            rep_lid_2 = selling_listings[1]

            conn.execute(
                text("""
                    INSERT INTO reports (listing_id, reporter_id, reason, note, status, created_at)
                    VALUES (:lid, :reporter_id, 'wrong_score', :note, 'new', :created_at)
                    ON CONFLICT (reporter_id, listing_id) DO NOTHING
                """),
                {
                    "lid": rep_lid_1,
                    "reporter_id": buyer_id,
                    "note": "Người bán tự chấm điểm 9.5 nhưng mô tả có vết xước sâu, nghi ngờ khai khống điểm số.",
                    "created_at": now - timedelta(hours=1),
                }
            )

            conn.execute(
                text("""
                    INSERT INTO reports (listing_id, reporter_id, reason, note, status, created_at)
                    VALUES (:lid, :reporter_id, 'scam', :note, 'new', :created_at)
                    ON CONFLICT (reporter_id, listing_id) DO NOTHING
                """),
                {
                    "lid": rep_lid_2,
                    "reporter_id": buyer_id,
                    "note": "Nghi ngờ người bán dùng số điện thoại ảo và không cho xem hàng trực tiếp tại địa chỉ ghim.",
                    "created_at": now - timedelta(hours=3),
                }
            )
            print(f"  ✓ Đã tạo 2 báo cáo vi phạm (Tin #{rep_lid_1} và Tin #{rep_lid_2}) cho tài khoản Admin kiểm tra.")

        # 5. Tạo tin Yêu thích mẫu (Favorites) cho tài khoản người mua
        print("\n[5/5] Đang lưu 3 tin yêu thích mẫu cho tài khoản buyer@ecofind.vn...")
        if len(selling_listings) >= 4:
            for fav_lid in selling_listings[2:5]:
                conn.execute(
                    text("""
                        INSERT INTO favorites (user_id, listing_id, created_at)
                        VALUES (:uid, :lid, :created_at)
                        ON CONFLICT (user_id, listing_id) DO NOTHING
                    """),
                    {
                        "uid": buyer_id,
                        "lid": fav_lid,
                        "created_at": now - timedelta(minutes=30),
                    }
                )
            print("  ✓ Đã tạo 3 tin yêu thích sẵn sàng khi đăng nhập tài khoản người mua.")

    print("\n==================================================================")
    print("             🎉 NẠP BỘ DỮ LIỆU DEMO THÀNH CÔNG!                   ")
    print("==================================================================")
    print("\n📋 DANH SÁCH TÀI KHOẢN ĐỂ TEST & THUYẾT TRÌNH:")
    print("┌───────────────────────────┬──────────────┬────────┬───────────────────────────────────────┐")
    print("│ Email                     │ Mật khẩu     │ Vai trò│ Kịch bản trải nghiệm chính            │")
    print("├───────────────────────────┼──────────────┼────────┼───────────────────────────────────────┤")
    print("│ admin@ecofind.vn          │ Admin@123    │ admin  │ Duyệt 3 tin chờ duyệt & xử lý 2 report│")
    print("│ seller1@ecofind.vn        │ Demo@1234    │ user   │ Quản lý tin công nghệ, sửa tin, ẩn tin│")
    print("│ seller2@ecofind.vn        │ Demo@1234    │ user   │ Quản lý tin gia dụng & nội thất       │")
    print("│ buyer@ecofind.vn          │ Demo@1234    │ user   │ Xem 3 tin Yêu thích, xem SĐT, báo cáo │")
    print("└───────────────────────────┴──────────────┴────────┴───────────────────────────────────────┘")
    print("\n📍 BẢN ĐỒ: 28 tin đang bán đã sẵn sàng hiển thị tại trung tâm TP.HCM!")
    print("==================================================================\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Seed demo listings for EcoFind")
    parser.add_argument("--clean", action="store_true", default=True, help="Clean existing demo data before seeding (default: True)")
    parser.add_argument("--no-clean", dest="clean", action="store_false", help="Do not clean existing demo data")
    args = parser.parse_args()

    seed_demo(clean=args.clean)
