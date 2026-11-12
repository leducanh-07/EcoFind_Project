"""
Unit and Integration Tests for Filter by Category, District & Radius API
(TE9C738, STT 22, UC-03, FR-06, SDD 6.3, SDD 7.2).
Uses real async SQLite database via aiosqlite + PostgreSQL dialect SQL verification.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import math
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.core.districts import resolve_district
from app.core.geo import bounding_box_for_radius, haversine_km
from app.models.category import Category
from app.models.listing import Listing
from app.models.user import User
from app.repositories.listing_repository import ListingRepository


def _setup_sqlite_db(tmp_path):
    """Tạo CSDL SQLite với các danh mục, quận TP.HCM và tin đăng tại nhiều khoảng cách khác nhau."""
    db_file = tmp_path / "test_filter.db"
    db_url = f"sqlite+aiosqlite:///{db_file}"
    engine = create_async_engine(db_url, echo=False)
    async_session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def _seed():
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)

        now = datetime.now(timezone.utc)
        async with async_session_factory() as session:
            seller = User(
                user_id=1,
                full_name="Người Bán Quận 1",
                email="seller_filter@ecofind.vn",
                phone="0909876543",
                password_hash="hashed_pw",
                role="user",
            )
            cat_furn = Category(category_id=1, name="Nội thất")
            cat_elec = Category(category_id=2, name="Đồ điện tử")
            cat_book = Category(category_id=3, name="Sách & Văn phòng phẩm")
            session.add_all([seller, cat_furn, cat_elec, cat_book])

            # Tâm Quận 1: (10.7757, 106.7004)
            items = [
                # 1. Đúng tâm Quận 1 (distance = 0.0 km), Đồ điện tử
                Listing(
                    listing_id=1,
                    seller_id=1,
                    category_id=2,
                    title="iPhone 13 Pro cũ",
                    description="Máy nguyên bản, pin 90%.",
                    price=Decimal("13500000"),
                    address="123 Lê Lợi, Quận 1, TP.HCM",
                    lat=10.7757,
                    lng=106.7004,
                    score_appearance=Decimal("9.0"),
                    score_function=Decimal("9.5"),
                    score_accessories=Decimal("8.5"),
                    total_score=Decimal("9.1"),
                    status="selling",
                    created_at=now - timedelta(minutes=1),
                ),
                # 2. Quận 1 dạng viết tắt Q.1 (~0.25 km từ tâm Q1), Nội thất
                Listing(
                    listing_id=2,
                    seller_id=1,
                    category_id=1,
                    title="Ghế công thái học",
                    description="Lưới thoáng khí còn mới.",
                    price=Decimal("1800000"),
                    address="45 Đồng Khởi, Q.1, TP.HCM",
                    lat=10.7765,
                    lng=106.7025,
                    score_appearance=Decimal("8.5"),
                    score_function=Decimal("8.5"),
                    score_accessories=Decimal("7.0"),
                    total_score=Decimal("8.2"),
                    status="selling",
                    created_at=now - timedelta(minutes=2),
                ),
                # 3. Quận 3 (~1.99 km từ tâm Q1), Đồ điện tử
                Listing(
                    listing_id=3,
                    seller_id=1,
                    category_id=2,
                    title="iPad Air 5",
                    description="Màn hình đẹp không trầy.",
                    price=Decimal("9500000"),
                    address="78 Võ Văn Tần, Quận 3, TP.HCM",
                    lat=10.7844,
                    lng=106.6844,
                    score_appearance=Decimal("8.0"),
                    score_function=Decimal("9.0"),
                    score_accessories=Decimal("8.0"),
                    total_score=Decimal("8.4"),
                    status="selling",
                    created_at=now - timedelta(minutes=3),
                ),
                # 4. Quận 10 (~3.54 km từ tâm Q1) - kiểm tra KHÔNG bị khớp nhầm khi lọc 'Quận 1'
                Listing(
                    listing_id=4,
                    seller_id=1,
                    category_id=2,
                    title="Loa Bluetooth JBL",
                    description="Âm thanh lớn rõ ràng.",
                    price=Decimal("1200000"),
                    address="456 Đường 3/2, Quận 10, TP.HCM",
                    lat=10.7746,
                    lng=106.6680,
                    score_appearance=Decimal("8.0"),
                    score_function=Decimal("8.0"),
                    score_accessories=Decimal("7.5"),
                    total_score=Decimal("7.9"),
                    status="selling",
                    created_at=now - timedelta(minutes=4),
                ),
                # 5. Điểm ở góc khung vuông 5km (~6.24 km từ tâm Q1 -> nằm trong coarse bbox 5km nhưng ngoài bán kính tròn 5km!)
                Listing(
                    listing_id=5,
                    seller_id=1,
                    category_id=2,
                    title="Màn hình Dell 24 inch",
                    description="Chân đế xoay 90 độ.",
                    price=Decimal("2400000"),
                    address="Khu vực Quận 2 cũ, TP.HCM",
                    lat=10.7757 + 0.04,
                    lng=106.7004 + 0.04,
                    score_appearance=Decimal("7.5"),
                    score_function=Decimal("8.0"),
                    score_accessories=Decimal("7.0"),
                    total_score=Decimal("7.6"),
                    status="selling",
                    created_at=now - timedelta(minutes=5),
                ),
                # 6. TP. Thủ Đức (~10.0 km từ tâm Q1), Sách
                Listing(
                    listing_id=6,
                    seller_id=1,
                    category_id=3,
                    title="Bộ sách Clean Architecture",
                    description="Sách tiếng Anh giấy đẹp.",
                    price=Decimal("320000"),
                    address="12 Võ Văn Ngân, Thủ Đức, TP.HCM",
                    lat=10.8494,
                    lng=106.7537,
                    score_appearance=Decimal("9.0"),
                    score_function=Decimal("9.5"),
                    score_accessories=Decimal("9.0"),
                    total_score=Decimal("9.2"),
                    status="selling",
                    created_at=now - timedelta(minutes=6),
                ),
                # 7. Tin pending ở Quận 1 -> KHÔNG được phép xuất hiện
                Listing(
                    listing_id=7,
                    seller_id=1,
                    category_id=2,
                    title="MacBook chờ duyệt",
                    description="Tin chưa duyệt.",
                    price=Decimal("18000000"),
                    address="10 Nguyễn Huệ, Quận 1, TP.HCM",
                    lat=10.7757,
                    lng=106.7004,
                    score_appearance=Decimal("9.0"),
                    score_function=Decimal("9.0"),
                    score_accessories=Decimal("9.0"),
                    total_score=Decimal("9.0"),
                    status="pending",
                    created_at=now,
                ),
            ]
            session.add_all(items)
            await session.commit()
        await engine.dispose()

    asyncio.run(_seed())
    return db_url


def _make_client_with_sqlite(db_url):
    engine = create_async_engine(db_url, echo=False)
    async_session_factory = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async def override_get_db():
        async with async_session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    return engine


def test_filter_by_category_id_and_name(tmp_path):
    """FR-06: Lọc theo tham số category (cả ID danh mục lẫn tên danh mục) và chỉ tin selling."""
    db_url = _setup_sqlite_db(tmp_path)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        # Lọc theo ID danh mục 1 (Nội thất) bằng tham số category và category_id
        res_id = client.get("/api/listings", params={"category": "1"})
        assert res_id.status_code == 200
        assert [item["id"] for item in res_id.json()] == [2]
        assert res_id.json()[0]["categoryName"] == "Nội thất"

        res_cat_id = client.get("/api/listings", params={"category_id": 1})
        assert res_cat_id.status_code == 200
        assert [item["id"] for item in res_cat_id.json()] == [2]

        # Lọc theo tên danh mục 'Đồ điện tử' (chỉ trả tin selling: 1, 3, 4, 5; bỏ tin pending id=7)
        res_name = client.get("/api/listings", params={"category": "Đồ điện tử"})
        assert res_name.status_code == 200
        ids = {item["id"] for item in res_name.json()}
        assert ids == {1, 3, 4, 5}
        assert 7 not in ids

        # category <= 0 trả 400
        res_bad = client.get("/api/listings", params={"category": "0"})
        assert res_bad.status_code == 400
        assert "category" in res_bad.json()["error"]["fields"]
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_filter_by_district_and_center_distance(tmp_path):
    """
    FR-06, STT 22:
      - Lọc khu vực 'district' khớp chuỗi address + bảng tọa độ trung tâm từng quận.
      - 'Quận 1' khớp 'Quận 1' và 'Q.1', KHÔNG khớp nhầm sang 'Quận 10'.
      - Khi không truyền lat/lng, trả về distance (km) tính từ trung tâm quận và sắp xếp gần trước.
    """
    db_url = _setup_sqlite_db(tmp_path)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        res = client.get("/api/listings", params={"district": "Quận 1"})
        assert res.status_code == 200
        data = res.json()
        # Chỉ id=1 (0.0 km) và id=2 (Q.1, ~0.25 km). Loại id=4 (Quận 10) và id=7 (pending)
        assert [item["id"] for item in data] == [1, 2]
        assert data[0]["distance"] == 0.0
        assert 0.1 < data[1]["distance"] < 0.5

        # Tra cứu không dấu / viết tắt 'q1' cũng cho kết quả tương tự
        res_alias = client.get("/api/listings", params={"district": "q1"})
        assert res_alias.status_code == 200
        assert [item["id"] for item in res_alias.json()] == [1, 2]

        # 'TP. Thủ Đức' khớp địa chỉ chứa 'Thủ Đức' và distance = 0.0 tại tâm Thủ Đức
        res_td = client.get("/api/listings", params={"district": "TP. Thủ Đức"})
        assert res_td.status_code == 200
        td_data = res_td.json()
        assert [item["id"] for item in td_data] == [6]
        assert td_data[0]["distance"] == 0.0
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_filter_by_lat_lng_and_radius_coarse_plus_haversine(tmp_path):
    """
    FR-06, SDD 6.3:
      - Lọc thô bằng khung lat/lng rồi lọc Haversine chính xác đến bán kính radius (1–20 km).
      - Điểm nằm trong góc hình vuông bbox (6.24 km) nhưng ngoài đường tròn bán kính 5 km phải bị loại!
      - Kết quả có trường distance (km) và sắp xếp gần nhất trước.
    """
    db_url = _setup_sqlite_db(tmp_path)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        # Bán kính 5 km quanh tâm Quận 1 (10.7757, 106.7004)
        res_5 = client.get(
            "/api/listings",
            params={"lat": 10.7757, "lng": 106.7004, "radius": 5},
        )
        assert res_5.status_code == 200
        data_5 = res_5.json()
        # Phải gồm id=1 (0 km), id=2 (~0.25 km), id=3 (~1.99 km), id=4 (~3.54 km)
        # Loại id=5 (~6.24 km ở góc bbox!), id=6 (~10 km), id=7 (pending)
        assert [item["id"] for item in data_5] == [1, 2, 3, 4]
        distances = [item["distance"] for item in data_5]
        assert distances == sorted(distances)
        assert all(d is not None and d <= 5.0 for d in distances)

        # Bán kính 2 km quanh tâm Quận 1 -> chỉ giữ id=1 (0 km) và id=2 (0.25 km) và id=3 (~1.99 km)
        res_2 = client.get(
            "/api/listings",
            params={"lat": 10.7757, "lng": 106.7004, "radius": 2},
        )
        assert res_2.status_code == 200
        data_2 = res_2.json()
        assert [item["id"] for item in data_2] == [1, 2, 3]
        assert all(item["distance"] <= 2.0 for item in data_2)

        # Bán kính 1 km -> chỉ id=1 và id=2
        res_1 = client.get(
            "/api/listings",
            params={"lat": 10.7757, "lng": 106.7004, "radius": 1},
        )
        assert res_1.status_code == 200
        assert [item["id"] for item in res_1.json()] == [1, 2]

        # Bán kính 20 km -> bao gồm cả id=5 (6.24 km) và id=6 (~10 km)
        res_20 = client.get(
            "/api/listings",
            params={"lat": 10.7757, "lng": 106.7004, "radius": 20},
        )
        assert res_20.status_code == 200
        assert [item["id"] for item in res_20.json()] == [1, 2, 3, 4, 5, 6]
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_filter_radius_with_district_center_fallback(tmp_path):
    """
    Kết hợp district + radius khi người dùng không gửi lat/lng:
    dùng tọa độ trung tâm của quận trong DISTRICT_CENTERS để lọc bán kính và tính distance.
    """
    db_url = _setup_sqlite_db(tmp_path)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        res = client.get(
            "/api/listings",
            params={"district": "Quận 1", "radius": 1},
        )
        assert res.status_code == 200
        data = res.json()
        assert [item["id"] for item in data] == [1, 2]
        assert all(item["distance"] <= 1.0 for item in data)
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_radius_and_coordinates_out_of_range_return_400(tmp_path):
    """
    Tiêu chí chấp nhận: radius ngoài khoảng 1–20 km trả 400; tọa độ không hợp lệ trả 400.
    """
    db_url = _setup_sqlite_db(tmp_path)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        invalid_cases = [
            {"lat": 10.7757, "lng": 106.7004, "radius": 0},
            {"lat": 10.7757, "lng": 106.7004, "radius": 0.9},
            {"lat": 10.7757, "lng": 106.7004, "radius": -5},
            {"lat": 10.7757, "lng": 106.7004, "radius": 20.1},
            {"lat": 10.7757, "lng": 106.7004, "radius": 50},
            {"radius": 5},  # Thiếu cả (lat, lng) và district trung tâm
            {"lat": 10.7757},  # Thiếu lng
            {"lng": 106.7004},  # Thiếu lat
            {"lat": 95.0, "lng": 106.7},  # Vĩ độ ngoài [-90, 90]
            {"lat": 10.7, "lng": 185.0},  # Kinh độ ngoài [-180, 180]
        ]
        for params in invalid_cases:
            res = client.get("/api/listings", params=params)
            assert res.status_code == 400, f"Expected 400 for params={params}, got {res.status_code}"
            assert res.json()["error"]["code"] == 400
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_combined_filters_q_category_district_radius_and_empty_bbox_overlap(tmp_path):
    """
    Kết hợp đồng thời từ khóa q, category, district, lat/lng, radius, bbox và kiểm tra khi không giao nhau.
    """
    db_url = _setup_sqlite_db(tmp_path)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        res = client.get(
            "/api/listings",
            params={
                "q": "iphone",
                "category": "2",
                "district": "Quận 1",
                "lat": 10.7757,
                "lng": 106.7004,
                "radius": 5,
            },
        )
        assert res.status_code == 200
        assert [item["id"] for item in res.json()] == [1]

        # Khi bbox (ở Hà Nội) không giao với bán kính 5km tại TP.HCM -> trả về []
        res_empty = client.get(
            "/api/listings",
            params={
                "bbox": "105.7,20.9,105.9,21.1",
                "lat": 10.7757,
                "lng": 106.7004,
                "radius": 5,
            },
        )
        assert res_empty.status_code == 200
        assert res_empty.json() == []
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_postgresql_coarse_bbox_and_haversine_sql_uses_indexes():
    """
    Xác minh câu truy vấn biên dịch cho PostgreSQL gồm:
      - status = 'selling' + khung lat/lng để dùng idx_listings_map (SDD 6.2, 6.3).
      - category_id để dùng idx_listings_category.
      - Biểu thức Haversine lọc bán kính và sắp xếp gần nhất trước.
    """
    center_lat, center_lng, radius_km = 10.7757, 106.7004, 5.0
    bounds = bounding_box_for_radius(center_lat, center_lng, radius_km)
    min_lng, min_lat, max_lng, max_lat = bounds

    stmt = select(Listing).where(
        Listing.status == "selling",
        Listing.lat >= min_lat,
        Listing.lat <= max_lat,
        Listing.lng >= min_lng,
        Listing.lng <= max_lng,
    )
    stmt = ListingRepository._apply_category_filter(stmt, category_id=2)
    dist_expr = ListingRepository._haversine_sql(center_lat, center_lng)
    stmt = stmt.where(dist_expr <= radius_km).order_by(dist_expr.asc()).limit(50)

    sql = str(stmt.compile(dialect=postgresql.dialect()))
    assert "listings.status = %(status_1)s" in sql
    assert "listings.lat >= %(lat_1)s" in sql
    assert "listings.lat <= %(lat_2)s" in sql
    assert "listings.lng >= %(lng_1)s" in sql
    assert "listings.lng <= %(lng_2)s" in sql
    assert "listings.category_id = %(category_id_1)s" in sql
    assert "asin(sqrt(" in sql
    assert "ORDER BY" in sql
    assert "LIMIT" in sql


def test_geo_haversine_and_district_center_helpers():
    """Kiểm tra độ chính xác công thức Haversine R=6371 km và bảng trung tâm quận."""
    assert haversine_km(10.7757, 106.7004, 10.7757, 106.7004) == 0.0
    dist_q1_q3 = haversine_km(10.7757, 106.7004, 10.7844, 106.6844)
    assert math.isclose(dist_q1_q3, 1.99, abs_tol=0.05)

    # Bảng quận hỗ trợ đầy đủ 22 đơn vị hành chính TP.HCM (cùng các alias)
    assert resolve_district("Quận 1").name == "Quận 1"
    assert resolve_district("Binh Thanh").name == "Bình Thạnh"
    assert resolve_district("Thủ Đức").name == "TP. Thủ Đức"
    assert resolve_district("Không tồn tại") is None
