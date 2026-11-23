"""
Script sinh 10.000 tin đăng mẫu tại TP.HCM phục vụ đo kiểm hiệu năng (Task TE9C757, STT 53).
Tuân thủ SRS (NFR-PER-01, NFR-PER-02, TC-02, TC-03), SDD mục 6.1, 6.2, 6.3.

Tiêu chí:
- Phân bổ 10.000 tin mẫu tại các quận/huyện TP.HCM.
- Tọa độ lat/lng thực tế tại TP.HCM (lat: 10.65 - 10.90, lng: 106.55 - 106.85).
- Đầy đủ 6-7 danh mục sản phẩm có sẵn trong CSDL.
- Điểm đánh giá tình trạng BR-01 (Ngoại quan, Chức năng, Phụ kiện, Điểm tổng).
- Giá bán BR-05 (0 đ - 25.000.000 đ, có cả hàng cho tặng 0 đ).
- Ảnh mẫu (listing_photos).
- Chạy nhanh bằng bulk insert theo batch.
"""

import sys
import os
import random
import time
from datetime import datetime, timezone, timedelta
from decimal import Decimal
import sqlite3

# Thêm thư mục gốc vào sys.path để import app nếu cần
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# Danh sách 20 quận/huyện trọng điểm tại TP.HCM với tọa độ tâm và bán kính (km)
DISTRICTS_HCMC = [
    {"name": "Quận 1", "lat": 10.7756, "lng": 106.7004, "radius_km": 1.5},
    {"name": "Quận 3", "lat": 10.7844, "lng": 106.6844, "radius_km": 1.2},
    {"name": "Quận 4", "lat": 10.7645, "lng": 106.7056, "radius_km": 1.2},
    {"name": "Quận 5", "lat": 10.7540, "lng": 106.6634, "radius_km": 1.5},
    {"name": "Quận 6", "lat": 10.7481, "lng": 106.6353, "radius_km": 1.8},
    {"name": "Quận 7", "lat": 10.7327, "lng": 106.7167, "radius_km": 3.0},
    {"name": "Quận 8", "lat": 10.7241, "lng": 106.6286, "radius_km": 2.5},
    {"name": "Quận 10", "lat": 10.7716, "lng": 106.6672, "radius_km": 1.2},
    {"name": "Quận 11", "lat": 10.7629, "lng": 106.6504, "radius_km": 1.5},
    {"name": "Quận 12", "lat": 10.8672, "lng": 106.6413, "radius_km": 3.5},
    {"name": "Bình Thạnh", "lat": 10.8030, "lng": 106.6990, "radius_km": 2.2},
    {"name": "Phú Nhuận", "lat": 10.7992, "lng": 106.6803, "radius_km": 1.2},
    {"name": "Tân Bình", "lat": 10.8015, "lng": 106.6557, "radius_km": 2.5},
    {"name": "Tân Phú", "lat": 10.7901, "lng": 106.6280, "radius_km": 2.2},
    {"name": "Gò Vấp", "lat": 10.8387, "lng": 106.6653, "radius_km": 2.5},
    {"name": "Bình Tân", "lat": 10.7654, "lng": 106.6039, "radius_km": 3.2},
    {"name": "Thủ Đức", "lat": 10.8494, "lng": 106.7537, "radius_km": 4.5},
    {"name": "Hóc Môn", "lat": 10.8845, "lng": 106.5921, "radius_km": 3.5},
    {"name": "Bình Chánh", "lat": 10.6874, "lng": 106.5921, "radius_km": 4.0},
    {"name": "Nhà Bè", "lat": 10.6953, "lng": 106.7297, "radius_km": 3.5},
]

# Tên đường phố thực tế tại TP.HCM
STREETS = [
    "Nguyễn Thị Minh Khai", "Lê Lợi", "Nguyễn Huệ", "Điện Biên Phủ",
    "Cách Mạng Tháng Tám", "Hoàng Văn Thụ", "Cộng Hòa", "Quang Trung",
    "Phan Đăng Lưu", "Bạch Đằng", "Xô Viết Nghệ Tĩnh", "Võ Văn Kiệt",
    "Trần Hưng Đạo", "Nguyễn Trãi", "Lý Thường Kiệt", "Ba Tháng Hai",
    "Phạm Văn Đồng", "Nguyễn Oanh", "Kha Vạn Cân", "Võ Nguyên Giáp",
    "Nguyễn Văn Linh", "Huỳnh Tấn Phát", "Lê Văn Lương", "Trường Chinh",
]

# Dữ liệu sản phẩm mẫu theo 7 danh mục
PRODUCTS_BY_CATEGORY = {
    1: {  # Nội thất
        "items": [
            ("Bàn làm việc gỗ thông 1m2", "Bàn còn rất chắc chắn, mặt bàn láng bóng, phù hợp cho học sinh hoặc làm việc tại nhà."),
            ("Ghế công thái học Ergonomic cũ", "Ghế xoay lưới thoáng khí, tựa lưng điều chỉnh êm ái, mới mua 6 tháng."),
            ("Kệ sách gỗ 4 tầng mini", "Kệ sách nhỏ gọn, tháo lắp dễ dàng, gỗ ép công nghiệp bền đẹp."),
            ("Tủ quần áo nhựa Duy Tân 5 ngăn", "Tủ nhựa còn nguyên vẹn, ngăn kéo trơn tru, dọn nhà thanh lý gấp."),
            ("Giường pallet gỗ thông 1m6 x 2m", "Giường pallet đã qua xử lý mối mọt, còn mới 90%, tự vận chuyển."),
            ("Bàn ăn thông minh gấp gọn", "Bàn ăn 4 ghế xếp gọn gàng, tiết kiệm không gian phòng trọ hoặc chung cư nhỏ."),
            ("Sofa nỉ phòng khách 2 chỗ ngồi", "Sofa màu xám lông chuột, đệm mút còn đàn hồi tốt, vải bọc sạch sẽ."),
            ("Tủ đầu giường gỗ sồi", "Tủ 2 ngăn kéo để đèn ngủ và sách báo, gỗ sồi tự nhiên chắc chắn."),
        ],
        "price_range": (150000, 3500000),
    },
    2: {  # Đồ điện tử
        "items": [
            ("Laptop Dell Latitude Core i5 8GB RAM", "Laptop văn phòng học tập, pin 3 tiếng, màn hình 14 inch Full HD sắc nét."),
            ("iPhone 11 64GB bản quốc tế", "Máy nguyên zin chưa qua sửa chữa, pin 85%, Face ID nhạy, kèm cáp sạc."),
            ("Bàn phím cơ AKKO 3087 Switch Brown", "Bàn phím cơ gõ êm, keycap PBT không bóng, đầy đủ hộp và phụ kiện."),
            ("Màn hình máy tính LG 24 inch IPS", "Màn hình 75Hz màu sắc đẹp, không điểm chết, cổng HDMI hoạt động tốt."),
            ("Tai nghe chống ồn Sony WH-1000XM3", "Tai nghe chụp tai pin trâu 25h, chống ồn đỉnh cao, đệm tai còn mới."),
            ("Chuột không dây Logitech G304", "Chuột gaming siêu nhạy, kết nối Lightspeed mượt mà, tặng kèm pin Eneloop."),
            ("iPad Gen 9 64GB Wifi", "Máy mua tại Thế Giới Di Động còn bảo hành 2 tháng, chủ yếu xem YouTube và đọc báo."),
            ("Loa Bluetooth JBL Flip 5 chính hãng", "Loa nghe nhạc ngoài trời âm bass lực, chống nước IPX7, pin dùng 10 tiếng."),
        ],
        "price_range": (300000, 15000000),
    },
    3: {  # Sách & Văn phòng phẩm
        "items": [
            ("Bộ sách Đắc Nhân Tâm & Quẳng Gánh Lo Đi", "Sách của First News, bản in rõ ràng, còn mới 98% chưa nhàu nát."),
            ("Giáo trình Kinh tế vi mô & vĩ mô ĐHQG", "Giáo trình photo có note bài giảng, phù hợp sinh viên năm 1-2 khối kinh tế."),
            ("Combo truyện tranh Thám tử lừng danh Conan", "Tập 50 đến 80 truyện tranh NXB Kim Đồng, giấy đẹp không rách mép."),
            ("Từ điển Anh - Việt 150.000 từ bìa cứng", "Từ điển dày bản đầy đủ, dành cho người ôn thi IELTS hoặc tự học."),
            ("Bảng vẽ điện tử Wacom Intuos Small", "Bảng vẽ dành cho vẽ đồ họa kỹ thuật số, còn đủ bút vẽ và ngòi dự phòng."),
            ("Sách Lập trình Python từ cơ bản đến nâng cao", "Sách bìa mềm kèm đĩa CD bài tập mẫu, nội dung chi tiết dễ hiểu."),
        ],
        "price_range": (30000, 1200000),
    },
    4: {  # Quần áo & Thời trang
        "items": [
            ("Áo khoác gió Uniqlo chống nước size L", "Áo gió mỏng nhẹ chống tia UV, mới mặc 2 lần đi Đà Lạt."),
            ("Quần jeans nam Levi's 511 Slim Fit size 31", "Quần bò chuẩn form, chất co giãn nhẹ, màu xanh đậm phong cách."),
            ("Balo laptop The North Face 15.6 inch", "Balo nhiều ngăn chống sốc cực tốt, đệm lưng êm ái thoáng khí."),
            ("Giày sneaker Nike Air Force 1 size 42", "Giày đi vài lần, đế còn nguyên gai, bao check hàng chính hãng."),
            ("Áo sơ mi nam An Phước dài tay", "Sơ mi kẻ sọc nhã nhặn, chất cotton thoáng mát, form đứng lịch sự."),
            ("Đồng hồ Casio Edifice dây da chính hãng", "Đồng hồ kính khoáng chống nước 100m, pin còn chạy chính xác."),
        ],
        "price_range": (80000, 2000000),
    },
    5: {  # Đồ gia dụng
        "items": [
            ("Nồi chiên không dầu Philips 4.5L", "Nồi chiên hoạt động êm ái, lớp chống dính còn nguyên, tặng kèm vỉ nướng."),
            ("Nồi cơm điện Cuckoo 1.8L", "Nồi cơm nấu dẻo ngon, giữ ấm cả ngày, lòng nồi gang dày dặn."),
            ("Quạt đứng lỡ Senko có hẹn giờ", "Quạt gió mát mạnh mẽ, chạy êm không kêu, động cơ đồng nguyên chất."),
            ("Bếp từ đơn Sunhouse tặng kèm nồi lẩu", "Bếp từ nấu lẩu ăn tại phòng trọ rất nhanh sôi, mặt kính chịu nhiệt."),
            ("Máy xay sinh tố Tefal 2 cối thủy tinh", "Cối xay thịt và xay hoa quả sắc bén, 2 tốc độ kèm nút nhồi."),
            ("Bình đun siêu tốc Lock&Lock 1.7L", "Bình đun inox 304 an toàn cho sức khỏe, đun sôi trong 3 phút."),
        ],
        "price_range": (100000, 1800000),
    },
    6: {  # Thể thao & Dã ngoại
        "items": [
            ("Vợt cầu lông Yonex Nanoray 7000i", "Vợt đã đan cước 10.5kg, nhẹ tay công thủ toàn diện, tặng bao đơn."),
            ("Giày chạy bộ Adidas Duramo size 41", "Giày êm ái đế bám đường tốt, dùng tập gym hoặc chạy bộ công viên."),
            ("Thảm tập Yoga TPE 6mm định tuyến", "Thảm cao su chống trượt tốt, độ dày 6mm bảo vệ khớp gối khi tập."),
            ("Xe đạp địa hình Asama khung nhôm 26 inch", "Xe đạp thể thao 21 tốc độ đĩa líp Shimano, phanh đĩa trước sau."),
            ("Lều cắm trại 4 người tự bung chống mưa", "Lều dựng nhanh trong 30 giây, vải chống thấm PU3000mm, có lưới chống muỗi."),
            ("Bộ tạ tay đa năng 20kg tháo lắp", "Gồm bánh tạ bọc cao su và thanh đòn nối dài thành tạ đòn."),
        ],
        "price_range": (120000, 4500000),
    },
    7: {  # Mẹ & Bé
        "items": [
            ("Xe đẩy trẻ em gấp gọn Aprica Nhật Bản", "Xe đẩy 2 chiều 3 tư thế nằm ngả ngồi, bánh xoay 360 độ êm ái."),
            ("Ghế ăn dặm Chicco điều chỉnh độ cao", "Ghế có khay ăn tháo rời vệ sinh được, gấp gọn tiết kiệm diện tích."),
            ("Địu em bé Ergobaby 4 tư thế có đỡ cổ", "Địu trợ lực êm vai, bé ngồi dáng chữ M chống loạn sản khớp háng."),
            ("Bộ đồ chơi xếp hình Lego Classic 500 chi tiết", "Đồ chơi kích thích sáng tạo cho bé từ 4 tuổi, đầy đủ hộp và sách hướng dẫn."),
            ("Máy tiệt trùng sấy khô bình sữa Fatzbaby", "Máy tiệt trùng hơi nước và sấy khô bằng tia UV, hoạt động hoàn hảo."),
        ],
        "price_range": (150000, 3000000),
    },
}

SAMPLE_PHOTO_URLS = [
    "https://images.unsplash.com/photo-1517336714731-489689fd1ca8?w=600",
    "https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=600",
    "https://images.unsplash.com/photo-1526170375885-4d8ecf77b99f?w=600",
    "https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=600",
    "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600",
    "https://images.unsplash.com/photo-1555041469-a586c61ea9bc?w=600",
    "https://images.unsplash.com/photo-1546868871-7041f2a55e12?w=600",
    "https://images.unsplash.com/photo-1583394838336-acd977736f90?w=600",
    "https://images.unsplash.com/photo-1527864550417-7fd91fc51a46?w=600",
    "https://images.unsplash.com/photo-1507473885765-e6ed057f782c?w=600",
]


def generate_random_coords(center_lat, center_lng, radius_km):
    """Sinh tọa độ ngẫu nhiên xung quanh tâm với bán kính radius_km (1 độ lat ~ 111km)."""
    # 1 độ lat ~ 111 km, 1 độ lng ~ 111 * cos(lat) ~ 109 km tại TP.HCM
    delta_lat = (radius_km / 111.0) * random.uniform(-1, 1)
    delta_lng = (radius_km / 109.0) * random.uniform(-1, 1)
    return round(center_lat + delta_lat, 6), round(center_lng + delta_lng, 6)


def calculate_total_score(appearance, function, accessories):
    """Tính điểm tổng BR-01: 0.4 * Ngoại quan + 0.4 * Chức năng + 0.2 * Phụ kiện (làm tròn 1 số lẻ)."""
    return round(0.4 * appearance + 0.4 * function + 0.2 * accessories, 1)


def seed_sellers(conn):
    """Đảm bảo có ít nhất 10 người bán mẫu trong bảng users."""
    cursor = conn.cursor()
    sellers_data = []
    for i in range(1, 11):
        email = f"seller{i}@ecofind.vn"
        full_name = f"Người bán {i} (TP.HCM)"
        phone = f"09{i:02d}123456"
        # Mật khẩu mặc định hash
        pwd_hash = "$2b$12$E0YlZVFAveSBIOIjARbD5.iiHmD0T1FWg5T6/iLxb/sDIxnaWu68K"
        sellers_data.append((full_name, email, phone, pwd_hash, "user"))

    # SQLite INSERT OR IGNORE
    cursor.executemany(
        """
        INSERT OR IGNORE INTO users (full_name, email, phone, password_hash, role)
        VALUES (?, ?, ?, ?, ?)
        """,
        sellers_data,
    )
    conn.commit()

    # Lấy danh sách seller_ids
    cursor.execute("SELECT user_id FROM users WHERE role = 'user'")
    seller_ids = [row[0] for row in cursor.fetchall()]
    return seller_ids if seller_ids else [1]


def seed_categories_if_needed(conn):
    """Đảm bảo các danh mục cơ bản đã có trong CSDL."""
    cursor = conn.cursor()
    categories = [
        (1, "Nội thất"),
        (2, "Đồ điện tử"),
        (3, "Sách & Văn phòng phẩm"),
        (4, "Quần áo & Thời trang"),
        (5, "Đồ gia dụng"),
        (6, "Thể thao & Dã ngoại"),
        (7, "Mẹ & Bé"),
    ]
    cursor.executemany(
        "INSERT OR IGNORE INTO categories (category_id, name) VALUES (?, ?)",
        categories,
    )
    conn.commit()


def create_performance_indexes_sqlite(conn):
    """Đảm bảo 7 chỉ mục tối ưu hiệu năng (SDD 6.2) đã được kích hoạt."""
    cursor = conn.cursor()
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_listings_map ON listings (lat, lng) WHERE status = 'selling'",
        "CREATE INDEX IF NOT EXISTS idx_listings_category ON listings (category_id) WHERE status = 'selling'",
        "CREATE INDEX IF NOT EXISTS idx_listings_seller ON listings (seller_id, status)",
        "CREATE INDEX IF NOT EXISTS idx_listings_pending ON listings (created_at) WHERE status = 'pending'",
        "CREATE INDEX IF NOT EXISTS idx_reports_queue ON reports (status, created_at)",
        "CREATE INDEX IF NOT EXISTS idx_favorites_listing ON favorites (listing_id)",
        "CREATE UNIQUE INDEX IF NOT EXISTS users_email_key ON users (email)",
    ]
    for idx_sql in indexes:
        cursor.execute(idx_sql)
    conn.commit()


def generate_10k_listings(db_path="ecofind.db", target_count=10000, clean=False):
    """Sinh đúng 10.000 tin mẫu và lưu vào CSDL."""
    print(f"=== Bắt đầu sinh {target_count:,} tin mẫu tại TP.HCM vào {db_path} ===")
    start_time = time.time()

    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()

    # 1. Chuẩn bị bảng và dữ liệu nền
    seed_categories_if_needed(conn)
    seller_ids = seed_sellers(conn)
    create_performance_indexes_sqlite(conn)

    if clean:
        print("Đang dọn dẹp dữ liệu tin đăng cũ...")
        cursor.execute("DELETE FROM listing_photos")
        cursor.execute("DELETE FROM listings")
        conn.commit()

    cursor.execute("SELECT COUNT(*) FROM listings")
    existing_count = cursor.fetchone()[0]
    needed_count = max(0, target_count - existing_count)

    if needed_count == 0:
        print(f"CSDL đã có sẵn {existing_count:,} tin đăng, không cần sinh thêm.")
        conn.close()
        return

    print(f"CSDL hiện có {existing_count:,} tin. Cần sinh thêm {needed_count:,} tin...")

    # 2. Sinh dữ liệu theo lô (Batching) để tối ưu I/O
    batch_size = 1000
    total_inserted = 0

    now = datetime.now(timezone.utc)
    base_time = now - timedelta(days=60)

    # Tỷ lệ trạng thái: 95% selling (để test bản đồ và tìm kiếm), 3% pending, 1% sold, 1% hidden
    status_weights = ["selling"] * 95 + ["pending"] * 3 + ["sold"] * 1 + ["hidden"] * 1

    for batch_start in range(0, needed_count, batch_size):
        current_batch_size = min(batch_size, needed_count - batch_start)
        listings_batch = []
        photos_batch = []

        for i in range(current_batch_size):
            cat_id = random.choice(list(PRODUCTS_BY_CATEGORY.keys()))
            cat_info = PRODUCTS_BY_CATEGORY[cat_id]
            title_base, desc_base = random.choice(cat_info["items"])

            # Thêm mã ngẫu nhiên để tiêu đề đa dạng
            item_num = existing_count + batch_start + i + 1
            title = f"{title_base} #{item_num:05d}"
            desc = f"{desc_base} Liên hệ trực tiếp để xem đồ và thỏa thuận."

            # Phân bổ giá bán (hỗ trợ 5% là đồ cho tặng 0 đ theo BR-05)
            if random.random() < 0.05:
                price = 0
            else:
                p_min, p_max = cat_info["price_range"]
                raw_price = random.randint(p_min // 10000, p_max // 10000) * 10000
                price = raw_price

            # Địa chỉ và Tọa độ TP.HCM
            district = random.choice(DISTRICTS_HCMC)
            street = random.choice(STREETS)
            street_no = random.randint(1, 999)
            address = f"{street_no} {street}, {district['name']}, TP.HCM"
            lat, lng = generate_random_coords(district["lat"], district["lng"], district["radius_km"])

            # Điểm tình trạng BR-01, BR-02
            app_score = round(random.uniform(6.0, 9.8), 1)
            func_score = round(random.uniform(6.5, 10.0), 1)
            acc_score = round(random.uniform(5.0, 9.5), 1)
            tot_score = calculate_total_score(app_score, func_score, acc_score)

            # Trạng thái
            status = random.choice(status_weights)
            created_at = (base_time + timedelta(minutes=random.randint(0, 86400))).isoformat()

            seller_id = random.choice(seller_ids)

            listings_batch.append((
                seller_id,
                cat_id,
                title,
                desc,
                price,
                address,
                lat,
                lng,
                app_score,
                func_score,
                acc_score,
                tot_score,
                status,
                0,  # hidden_by_admin = False
                created_at,
            ))

        # Thực thi Insert batch cho Listings
        cursor.executemany(
            """
            INSERT INTO listings (
                seller_id, category_id, title, description, price, address,
                lat, lng, score_appearance, score_function, score_accessories,
                total_score, status, hidden_by_admin, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            listings_batch,
        )

        # Lấy ID của các tin vừa chèn để sinh ảnh
        last_id = cursor.lastrowid
        first_id = last_id - current_batch_size + 1

        for idx, lid in enumerate(range(first_id, last_id + 1)):
            photo_count = random.choice([1, 1, 2, 3])
            sample_urls = random.sample(SAMPLE_PHOTO_URLS, min(photo_count, len(SAMPLE_PHOTO_URLS)))
            for sort_order, url in enumerate(sample_urls):
                photos_batch.append((lid, url, sort_order))

        cursor.executemany(
            "INSERT INTO listing_photos (listing_id, url, sort_order) VALUES (?, ?, ?)",
            photos_batch,
        )

        conn.commit()
        total_inserted += current_batch_size
        print(f"-> Đã sinh {total_inserted + existing_count:,} / {target_count:,} tin...")

    elapsed = time.time() - start_time
    cursor.execute("SELECT COUNT(*) FROM listings")
    final_count = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM listing_photos")
    photo_count = cursor.fetchone()[0]

    print(f"\n HOÀN TẤT trong {elapsed:.2f} giây!")
    print(f"Tổng số tin đăng trong CSDL: {final_count:,} tin.")
    print(f"Tổng số ảnh tin đăng: {photo_count:,} ảnh.")
    conn.close()


if __name__ == "__main__":
    db_file = "ecofind.db"
    generate_10k_listings(db_file, target_count=10000, clean=False)
