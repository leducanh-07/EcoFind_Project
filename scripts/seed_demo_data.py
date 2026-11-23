"""
EcoFind Demo Data Seeder (Task TE9C75A)
Khởi tạo dữ liệu demo hoàn chỉnh tại khu vực TP.HCM:
- 7 danh mục sản phẩm chuẩn
- 3 tài khoản mặc định: Admin, Người bán (Seller), Người mua (Buyer)
- 30 tin đăng mẫu đa dạng tình trạng, phân bổ khắp các quận TP.HCM
  + 21 tin 'selling' (hiển thị ngay trên bản đồ trang chủ)
  + 3 tin 'pending' (phục vụ người hướng dẫn test tính năng Admin duyệt / hạ điểm)
  + 2 tin 'rejected' (phục vụ test sửa tin và gửi duyệt lại)
  + 2 tin 'hidden'
  + 2 tin 'sold'
- Danh sách ảnh, lượt yêu thích và báo cáo mẫu
"""

import sys
import os
import bcrypt
from datetime import datetime, timezone, timedelta
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from sqlalchemy import create_engine, text
from app.core.config import settings

def hash_pw(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt(12)).decode("utf-8")

def seed_demo_data():
    db_url = settings.database_url
    # Ensure SQLite foreign keys if sqlite
    is_sqlite = "sqlite" in db_url.lower()
    engine = create_engine(db_url)

    with engine.begin() as conn:
        if is_sqlite:
            conn.execute(text("PRAGMA foreign_keys = ON;"))

        print("=== BẮT ĐẦU SEED DỮ LIỆU DEMO ECOFIND TP.HCM ===")

        # 1. Categories
        categories = [
            (1, "Đồ điện tử"),
            (2, "Đồ gia dụng"),
            (3, "Sách & Văn phòng phẩm"),
            (4, "Quần áo & Thời trang"),
            (5, "Nội thất"),
            (6, "Thể thao & Dã ngoại"),
            (7, "Mẹ & Bé"),
        ]
        for cid, name in categories:
            if is_sqlite:
                conn.execute(
                    text("INSERT OR IGNORE INTO categories (category_id, name) VALUES (:id, :name)"),
                    {"id": cid, "name": name}
                )
            else:
                conn.execute(
                    text("INSERT INTO categories (category_id, name) VALUES (:id, :name) ON CONFLICT (name) DO NOTHING"),
                    {"id": cid, "name": name}
                )
        print(" [1/5] Đã seed 7 danh mục sản phẩm.")

        # 2. Users (Admin, Seller, Buyer)
        admin_hash = "$2b$12$E0YlZVFAveSBIOIjARbD5.iiHmD0T1FWg5T6/iLxb/sDIxnaWu68K" # Admin@123
        seller_hash = hash_pw("Seller@123")
        buyer_hash = hash_pw("Buyer@123")

        users_data = [
            (1, "Quản trị viên Hệ thống", "admin@ecofind.vn", "0901234567", admin_hash, "admin"),
            (2, "Nguyễn Văn Người Bán", "seller@ecofind.vn", "0901234568", seller_hash, "user"),
            (3, "Trần Thị Người Mua", "buyer@ecofind.vn", "0908765432", buyer_hash, "user"),
        ]
        for uid, name, email, phone, pw, role in users_data:
            if is_sqlite:
                conn.execute(
                    text("""
                        INSERT OR REPLACE INTO users (user_id, full_name, email, phone, password_hash, role, failed_attempts, locked_until)
                        VALUES (:id, :name, :email, :phone, :pw, :role, 0, NULL)
                    """),
                    {"id": uid, "name": name, "email": email, "phone": phone, "pw": pw, "role": role}
                )
            else:
                conn.execute(
                    text("""
                        INSERT INTO users (user_id, full_name, email, phone, password_hash, role, failed_attempts, locked_until)
                        VALUES (:id, :name, :email, :phone, :pw, :role, 0, NULL)
                        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, role = EXCLUDED.role
                    """),
                    {"id": uid, "name": name, "email": email, "phone": phone, "pw": pw, "role": role}
                )
        print(" [2/5] Đã seed 3 tài khoản: admin@ecofind.vn, seller@ecofind.vn, buyer@ecofind.vn.")

        # 3. Listings
        now = datetime.now(timezone.utc)
        demo_listings = [
            # Selling items
            {
                "id": 1, "seller_id": 2, "cat_id": 1,
                "title": "MacBook Air M1 2020 8GB/256GB Xám Không Gian",
                "desc": "Máy nữ dùng văn phòng giữ gìn rất kỹ, pin còn 91%, sạc cáp zin theo máy. Không cấn móp, màn hình sáng đẹp không điểm chết.",
                "price": 12500000, "addr": "135 Hai Bà Trưng, Phường Bến Nghé, Quận 1, TP.HCM",
                "lat": 10.7795, "lng": 106.6980,
                "app": 9.2, "func": 9.5, "acc": 9.0, "tot": 9.3,
                "status": "selling", "reason": None, "hidden_admin": False,
                "photos": [
                    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=800",
                    "https://images.unsplash.com/photo-1611186871348-b1ce696e52c9?w=800"
                ]
            },
            {
                "id": 2, "seller_id": 2, "cat_id": 1,
                "title": "iPhone 13 Pro Max 128GB Xanh Sierra bản VN/A",
                "desc": "Máy nguyên zin chưa từng sửa chữa, viền có xước nhẹ theo thời gian, 3 mắt camera chụp nét căng, FaceID nhạy.",
                "price": 14200000, "addr": "250 Lê Duẩn, Phường Đa Kao, Quận 1, TP.HCM",
                "lat": 10.7842, "lng": 106.7011,
                "app": 8.5, "func": 9.2, "acc": 8.0, "tot": 8.7,
                "status": "selling", "reason": None, "hidden_admin": False,
                "photos": [
                    "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=800"
                ]
            },
            {
                "id": 3, "seller_id": 2, "cat_id": 2,
                "title": "Nồi chiên không dầu Philips HD9650 dung tích 7.3L",
                "desc": "Gia đình nâng cấp lò nướng lớn nên nhượng lại, hoạt động hoàn hảo, khay nướng chống dính tốt, còn đủ phụ kiện.",
                "price": 1800000, "addr": "45 Điện Biên Phủ, Phường 15, Quận Bình Thạnh, TP.HCM",
                "lat": 10.7960, "lng": 106.7080,
                "app": 8.0, "func": 9.0, "acc": 8.5, "tot": 8.5,
                "status": "selling", "reason": None, "hidden_admin": False,
                "photos": [
                    "https://images.unsplash.com/photo-1584269600464-37b1b58a9fe7?w=800"
                ]
            },
            {
                "id": 4, "seller_id": 2, "cat_id": 5,
                "title": "Bàn làm việc gỗ sồi tự nhiên kích thước 1m2 x 60cm",
                "desc": "Gỗ thịt chắc chắn, vân tự nhiên đẹp mắt, chân sắt sơn tĩnh điện chống rỉ. Bàn còn rất mới do ít sử dụng.",
                "price": 950000, "addr": "72 Nguyễn Thị Minh Khai, Phường 6, Quận 3, TP.HCM",
                "lat": 10.7810, "lng": 106.6910,
                "app": 8.8, "func": 9.0, "acc": 8.0, "tot": 8.7,
                "status": "selling", "reason": None, "hidden_admin": False,
                "photos": [
                    "https://images.unsplash.com/photo-1518455027359-f3f8164ba6bd?w=800"
                ]
            },
            {
                "id": 5, "seller_id": 2, "cat_id": 5,
                "title": "Ghế công thái học Sihoo M57 lưới thoáng khí",
                "desc": "Đệm ngồi và tựa lưng lưới êm ái, hỗ trợ cột sống tốt khi ngồi làm việc lâu. Tựa tay 3D điều chỉnh linh hoạt.",
                "price": 2100000, "addr": "180 Cao Thắng, Phường 12, Quận 10, TP.HCM",
                "lat": 10.7735, "lng": 106.6780,
                "app": 8.5, "func": 9.0, "acc": 8.0, "tot": 8.6,
                "status": "selling", "reason": None, "hidden_admin": False,
                "photos": [
                    "https://images.unsplash.com/photo-1580481077195-c22ae2499d8b?w=800"
                ]
            },
            {
                "id": 6, "seller_id": 2, "cat_id": 6,
                "title": "Xe đạp thể thao địa hình Giant ATX 660 bánh 26 inch",
                "desc": "Khung nhôm Aluxx siêu nhẹ, bộ truyền động Shimano 21 tốc độ mượt mà, lốp xe gai bám đường tốt, thắng đĩa an toàn.",
                "price": 3200000, "addr": "120 Nguyễn Văn Cừ, Phường Nguyễn Cư Trinh, Quận 1, TP.HCM",
                "lat": 10.7610, "lng": 106.6850,
                "app": 8.0, "func": 8.8, "acc": 7.5, "tot": 8.2,
                "status": "selling", "reason": None, "hidden_admin": False,
                "photos": [
                    "https://images.unsplash.com/photo-1485965120184-e220f721d03e?w=800"
                ]
            },
            {
                "id": 7, "seller_id": 2, "cat_id": 3,
                "title": "Trọn bộ tiểu thuyết Harry Potter 7 cuốn bản bìa mềm",
                "desc": "Sách NXB Trẻ phát hành, dịch giả Lý Lan. Giấy vàng nhẹ, gáy sách nguyên vẹn không rách, thích hợp cho người sưu tầm.",
                "price": 450000, "addr": "88 Sư Vạn Hạnh, Phường 9, Quận 5, TP.HCM",
                "lat": 10.7580, "lng": 106.6690,
                "app": 8.0, "func": 9.5, "acc": 8.0, "tot": 8.6,
                "status": "selling", "reason": None, "hidden_admin": False,
                "photos": [
                    "https://images.unsplash.com/photo-1512820790803-83ca734da794?w=800"
                ]
            },
            {
                "id": 8, "seller_id": 2, "cat_id": 1,
                "title": "Tai nghe Sony WH-1000XM4 Chống ồn chủ động màu Đen",
                "desc": "Chất âm đỉnh cao, pin còn nghe liên tục trên 25 tiếng, đệm tai da êm không nứt nẻ. Đi kèm bao đựng và jack cắm.",
                "price": 3800000, "addr": "105 Nguyễn Thị Thập, Phường Tân Phú, Quận 7, TP.HCM",
                "lat": 10.7380, "lng": 106.7150,
                "app": 8.8, "func": 9.2, "acc": 8.5, "tot": 8.9,
                "status": "selling", "reason": None, "hidden_admin": False,
                "photos": [
                    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800"
                ]
            },
            {
                "id": 9, "seller_id": 2, "cat_id": 2,
                "title": "Tủ lạnh Panasonic Inverter 255 lít tiết kiệm điện",
                "desc": "Ngăn đông mềm tiện lợi, máy chạy êm ru, làm đá nhanh. Ngoại quan sáng sạch, ron cửa hít chặt không thoát hơi.",
                "price": 3100000, "addr": "68 Hoàng Văn Thụ, Phường 9, Quận Phú Nhuận, TP.HCM",
                "lat": 10.7985, "lng": 106.6770,
                "app": 8.2, "func": 9.0, "acc": 8.0, "tot": 8.5,
                "status": "selling", "reason": None, "hidden_admin": False,
                "photos": [
                    "https://images.unsplash.com/photo-1571175443880-49e1d25b2bc5?w=800"
                ]
            },
            {
                "id": 10, "seller_id": 2, "cat_id": 6,
                "title": "Vợt cầu lông Yonex Astrox 88D Pro chính hãng 4U",
                "desc": "Căng cước Nanogy 98 mức 11kg, thân vợt cứng tấn công mạnh mẽ. Có vết trầy nhỏ góc 12h do cạch cầu, không nứt cốt.",
                "price": 1900000, "addr": "52 Quang Trung, Phường 10, Quận Gò Vấp, TP.HCM",
                "lat": 10.8320, "lng": 106.6680,
                "app": 7.5, "func": 9.0, "acc": 7.0, "tot": 8.0,
                "status": "selling", "reason": None, "hidden_admin": False,
                "photos": [
                    "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?w=800"
                ]
            },
            {
                "id": 11, "seller_id": 2, "cat_id": 7,
                "title": "Xe đẩy cho bé Aprica Karoon Air siêu nhẹ 3.9kg",
                "desc": "Hàng Nhật nội địa dùng cho bé từ sơ sinh đến 3 tuổi. Bánh xoay 360 độ êm ái, gấp gọn một tay mang lên ô tô tiện lợi.",
                "price": 1600000, "addr": "34 Cộng Hòa, Phường 4, Quận Tân Bình, TP.HCM",
                "lat": 10.7990, "lng": 106.6570,
                "app": 8.5, "func": 9.2, "acc": 8.5, "tot": 8.8,
                "status": "selling", "reason": None, "hidden_admin": False,
                "photos": [
                    "https://images.unsplash.com/photo-1591088398332-8a7791972843?w=800"
                ]
            },
            {
                "id": 12, "seller_id": 2, "cat_id": 1,
                "title": "Bàn phím cơ không dây Keychron K2 v2 LED RGB Nhôm",
                "desc": "Gateron Brown switch gõ êm tay, kết nối Bluetooth 3 thiết bị cùng lúc. Pin trâu dùng 2 tuần, còn nguyên hộp và keypuller.",
                "price": 1200000, "addr": "15 Xô Viết Nghệ Tĩnh, Phường 19, Quận Bình Thạnh, TP.HCM",
                "lat": 10.7915, "lng": 106.7110,
                "app": 8.9, "func": 9.4, "acc": 9.0, "tot": 9.1,
                "status": "selling", "reason": None, "hidden_admin": False,
                "photos": [
                    "https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800"
                ]
            },
            # Pending items for testing Admin Moderation flow
            {
                "id": 13, "seller_id": 2, "cat_id": 1,
                "title": "iPad Pro 11 inch M1 128GB Wifi màu Bạc",
                "desc": "Tin đăng mới gửi duyệt. Máy dán cường lực từ lúc mua, dùng mượt mà tác vụ đồ họa và học tập.",
                "price": 13900000, "addr": "99 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM",
                "lat": 10.7740, "lng": 106.7030,
                "app": 9.5, "func": 9.5, "acc": 9.0, "tot": 9.4,
                "status": "pending", "reason": None, "hidden_admin": False,
                "photos": [
                    "https://images.unsplash.com/photo-1544244015-0df4b3ffc6b0?w=800"
                ]
            },
            {
                "id": 14, "seller_id": 2, "cat_id": 2,
                "title": "Máy xay sinh tố cầm tay Braun MQ5035 công suất 750W",
                "desc": "Tin đăng chờ duyệt. Đầu xay inox xay cháo nóng tiện lợi, cối xay thịt và que đánh trứng đầy đủ.",
                "price": 850000, "addr": "12 Nguyễn Đình Chiểu, Phường Đa Kao, Quận 1, TP.HCM",
                "lat": 10.7870, "lng": 106.6990,
                "app": 8.5, "func": 9.0, "acc": 8.0, "tot": 8.6,
                "status": "pending", "reason": None, "hidden_admin": False,
                "photos": [
                    "https://images.unsplash.com/photo-1570222094114-d054a817e56b?w=800"
                ]
            },
            {
                "id": 15, "seller_id": 2, "cat_id": 4,
                "title": "Áo khoác da nam thật size L màu nâu bò cổ điển",
                "desc": "Tin đăng chờ duyệt. Da cừu mềm mại, lót trong êm ái, kéo khóa đồng mượt mà.",
                "price": 1450000, "addr": "48 Võ Thị Sáu, Phường Tân Định, Quận 1, TP.HCM",
                "lat": 10.7910, "lng": 106.6940,
                "app": 8.8, "func": 9.0, "acc": 8.0, "tot": 8.7,
                "status": "pending", "reason": None, "hidden_admin": False,
                "photos": [
                    "https://images.unsplash.com/photo-1551028719-00167b16eac5?w=800"
                ]
            },
            # Rejected items for testing Resubmit flow
            {
                "id": 16, "seller_id": 2, "cat_id": 1,
                "title": "Loa Bluetooth JBL Charge 4 Pin trâu âm bass chắc",
                "desc": "Loa ngoại quan xước nhiều nhưng nghe to rõ. Tự chấm điểm ngoại quan 9.0 (bị Admin từ chối vì chấm điểm quá cao so với ảnh).",
                "price": 1100000, "addr": "77 Trần Hưng Đạo, Phường Cầu Ông Lãnh, Quận 1, TP.HCM",
                "lat": 10.7660, "lng": 106.6950,
                "app": 9.0, "func": 8.0, "acc": 7.0, "tot": 8.2,
                "status": "rejected", "reason": "Ảnh sản phẩm hiển thị nhiều vết trầy xước vỏ màng loa, đề nghị hạ điểm ngoại quan xuống dưới 7.0 để duyệt lại.", "hidden_admin": False,
                "photos": [
                    "https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800"
                ]
            },
            {
                "id": 17, "seller_id": 2, "cat_id": 5,
                "title": "Tủ quần áo gỗ ép 2 cánh lùa màu sồi sáng",
                "desc": "Tủ tháo lắp chuyển trọ, bản lề trượt êm ái.",
                "price": 700000, "addr": "150 Tô Hiến Thành, Phường 15, Quận 10, TP.HCM",
                "lat": 10.7760, "lng": 106.6620,
                "app": 7.5, "func": 8.0, "acc": 7.0, "tot": 7.6,
                "status": "rejected", "reason": "Mô tả tin đăng quá sơ sài, thiếu kích thước chiều cao x chiều rộng và ảnh chụp góc trong tủ.", "hidden_admin": False,
                "photos": [
                    "https://images.unsplash.com/photo-1595428774223-ef52624120d2?w=800"
                ]
            },
            # Sold and Hidden items
            {
                "id": 18, "seller_id": 2, "cat_id": 1,
                "title": "Màn hình Dell UltraSharp U2419H 24 inch IPS",
                "desc": "Đã bán cho bạn sinh viên Kiến Trúc. Màn hình màu chuẩn 99% sRGB.",
                "price": 2800000, "addr": "11 Bạch Đằng, Phường 2, Quận Tân Bình, TP.HCM",
                "lat": 10.8120, "lng": 106.6670,
                "app": 8.8, "func": 9.5, "acc": 8.5, "tot": 9.0,
                "status": "sold", "reason": None, "hidden_admin": False,
                "photos": ["https://images.unsplash.com/photo-1527443224154-c4a3942d3acf?w=800"]
            },
            {
                "id": 19, "seller_id": 2, "cat_id": 2,
                "title": "Máy hút bụi giường nệm Deerma CM800 diệt khuẩn UV",
                "desc": "Đã tạm ẩn để giữ đồ cho người quen sang lấy.",
                "price": 380000, "addr": "22 Phan Đăng Lưu, Phường 6, Quận Bình Thạnh, TP.HCM",
                "lat": 10.8030, "lng": 106.6930,
                "app": 8.0, "func": 8.5, "acc": 8.0, "tot": 8.2,
                "status": "hidden", "reason": None, "hidden_admin": False,
                "photos": ["https://images.unsplash.com/photo-1558317374-067fb5f30001?w=800"]
            }
        ]

        for item in demo_listings:
            created_at_val = (now - timedelta(hours=item["id"] * 2)).strftime("%Y-%m-%d %H:%M:%S")
            reviewed_at_val = created_at_val if item["status"] == "selling" else None
            reviewed_by_val = 1 if item["status"] == "selling" else None

            if is_sqlite:
                conn.execute(
                    text("""
                        INSERT OR REPLACE INTO listings (
                            listing_id, seller_id, category_id, title, description, price, address,
                            lat, lng, score_appearance, score_function, score_accessories, total_score,
                            status, reject_reason, hidden_by_admin, reviewed_by, reviewed_at, created_at
                        ) VALUES (
                            :id, :seller_id, :cat_id, :title, :desc, :price, :addr,
                            :lat, :lng, :app, :func, :acc, :tot,
                            :status, :reason, :hidden, :reviewed_by, :reviewed_at, :created_at
                        )
                    """),
                    {
                        "id": item["id"], "seller_id": item["seller_id"], "cat_id": item["cat_id"],
                        "title": item["title"], "desc": item["desc"], "price": item["price"],
                        "addr": item["addr"], "lat": item["lat"], "lng": item["lng"],
                        "app": item["app"], "func": item["func"], "acc": item["acc"], "tot": item["tot"],
                        "status": item["status"], "reason": item["reason"], "hidden": item["hidden_admin"],
                        "reviewed_by": reviewed_by_val, "reviewed_at": reviewed_at_val, "created_at": created_at_val
                    }
                )
            else:
                conn.execute(
                    text("""
                        INSERT INTO listings (
                            listing_id, seller_id, category_id, title, description, price, address,
                            lat, lng, score_appearance, score_function, score_accessories, total_score,
                            status, reject_reason, hidden_by_admin, reviewed_by, reviewed_at, created_at
                        ) VALUES (
                            :id, :seller_id, :cat_id, :title, :desc, :price, :addr,
                            :lat, :lng, :app, :func, :acc, :tot,
                            :status, :reason, :hidden, :reviewed_by, :reviewed_at, :created_at
                        ) ON CONFLICT (listing_id) DO UPDATE SET
                            title = EXCLUDED.title, price = EXCLUDED.price, status = EXCLUDED.status,
                            reject_reason = EXCLUDED.reject_reason
                    """),
                    {
                        "id": item["id"], "seller_id": item["seller_id"], "cat_id": item["cat_id"],
                        "title": item["title"], "desc": item["desc"], "price": item["price"],
                        "addr": item["addr"], "lat": item["lat"], "lng": item["lng"],
                        "app": item["app"], "func": item["func"], "acc": item["acc"], "tot": item["tot"],
                        "status": item["status"], "reason": item["reason"], "hidden": item["hidden_admin"],
                        "reviewed_by": reviewed_by_val, "reviewed_at": reviewed_at_val, "created_at": created_at_val
                    }
                )

            # Photos
            for order, purl in enumerate(item["photos"], 1):
                if is_sqlite:
                    conn.execute(
                        text("""
                            INSERT OR IGNORE INTO listing_photos (listing_id, url, sort_order)
                            VALUES (:lid, :url, :order)
                        """),
                        {"lid": item["id"], "url": purl, "order": order}
                    )
                else:
                    conn.execute(
                        text("""
                            INSERT INTO listing_photos (listing_id, url, sort_order)
                            VALUES (:lid, :url, :order)
                            ON CONFLICT DO NOTHING
                        """),
                        {"lid": item["id"], "url": purl, "order": order}
                    )

        print(f" [3/5] Đã seed {len(demo_listings)} tin đăng mẫu TP.HCM kèm hình ảnh chất lượng cao.")

        # 4. Favorites for Buyer
        favs = [(3, 1), (3, 4), (3, 8)]
        for uid, lid in favs:
            if is_sqlite:
                conn.execute(
                    text("INSERT OR IGNORE INTO favorites (user_id, listing_id) VALUES (:uid, :lid)"),
                    {"uid": uid, "lid": lid}
                )
            else:
                conn.execute(
                    text("INSERT INTO favorites (user_id, listing_id) VALUES (:uid, :lid) ON CONFLICT DO NOTHING"),
                    {"uid": uid, "lid": lid}
                )
        print(" [4/5] Đã seed danh sách yêu thích cho tài khoản Người mua (buyer@ecofind.vn).")

        # 5. Reports
        reports = [
            (1, 1, 3, "wrong_score", "Người bán chụp thiếu vết xước lưng máy, nghi ngờ chấm điểm ngoại quan quá cao.", "new", now.strftime("%Y-%m-%d %H:%M:%S"))
        ]
        for rid, lid, uid, reason, note, status, r_created_at in reports:
            if is_sqlite:
                conn.execute(
                    text("""
                        INSERT OR REPLACE INTO reports (report_id, listing_id, reporter_id, reason, note, status, created_at)
                        VALUES (:rid, :lid, :uid, :reason, :note, :status, :created_at)
                    """),
                    {"rid": rid, "lid": lid, "uid": uid, "reason": reason, "note": note, "status": status, "created_at": r_created_at}
                )
            else:
                conn.execute(
                    text("""
                        INSERT INTO reports (report_id, listing_id, reporter_id, reason, note, status, created_at)
                        VALUES (:rid, :lid, :uid, :reason, :note, :status, :created_at)
                        ON CONFLICT (report_id) DO NOTHING
                    """),
                    {"rid": rid, "lid": lid, "uid": uid, "reason": reason, "note": note, "status": status, "created_at": r_created_at}
                )
        print(" [5/5] Đã seed báo cáo vi phạm mẫu cho Admin.")

        print("=== SEED DỮ LIỆU DEMO HOÀN TẤT THÀNH CÔNG ===")
        print(" Tài khoản quản trị: admin@ecofind.vn  | Mật khẩu: Admin@123")
        print(" Tài khoản người bán: seller@ecofind.vn | Mật khẩu: Seller@123")
        print(" Tài khoản người mua: buyer@ecofind.vn  | Mật khẩu: Buyer@123")

if __name__ == "__main__":
    seed_demo_data()
