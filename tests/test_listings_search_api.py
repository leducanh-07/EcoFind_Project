"""
Unit and Integration Tests for Keyword Search API (TE9C737, UC-03, FR-05, UC-03 E1, TC-12).
Uses real async SQLite database via aiosqlite + PostgreSQL dialect SQL compilation verification.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.models.category import Category
from app.models.listing import Listing
from app.models.user import User
from app.repositories.listing_repository import ListingRepository


def _setup_sqlite_db(tmp_path, extra_listings=None):
    """Tạo CSDL SQLite thật với bảng từ ORM Base và dữ liệu mẫu phục vụ kiểm thử tìm kiếm."""
    db_file = tmp_path / "test_search.db"
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
                full_name="Nguyễn Văn Bán Đồ",
                email="seller_search@ecofind.vn",
                phone="0901234567",
                password_hash="hashed_pw",
                role="user",
            )
            cat_elec = Category(category_id=1, name="Đồ điện tử")
            cat_furn = Category(category_id=2, name="Nội thất")
            session.add_all([seller, cat_elec, cat_furn])

            base_items = [
                Listing(
                    listing_id=1,
                    seller_id=1,
                    category_id=1,
                    title="MacBook Pro M2 14 inch",
                    description="Máy đẹp 99%, nguyên zin chưa sửa chữa.",
                    price=Decimal("25000000"),
                    address="Quận 1, TP.HCM",
                    lat=10.775,
                    lng=106.700,
                    score_appearance=Decimal("9.5"),
                    score_function=Decimal("9.5"),
                    score_accessories=Decimal("9.0"),
                    total_score=Decimal("9.4"),
                    status="selling",
                    created_at=now - timedelta(minutes=1),
                ),
                Listing(
                    listing_id=2,
                    seller_id=1,
                    category_id=2,
                    title="Bàn làm việc gỗ thông",
                    description="Mặt bàn rộng rãi, rất hợp để LAPTOP và màn hình ngoài.",
                    price=Decimal("950000"),
                    address="Quận 3, TP.HCM",
                    lat=10.780,
                    lng=106.690,
                    score_appearance=Decimal("8.0"),
                    score_function=Decimal("8.5"),
                    score_accessories=Decimal("6.0"),
                    total_score=Decimal("7.8"),
                    status="selling",
                    created_at=now - timedelta(minutes=2),
                ),
                Listing(
                    listing_id=3,
                    seller_id=1,
                    category_id=1,
                    title="Tai nghe Bluetooth SONY WH-1000XM4",
                    description="Chống ồn chủ động, pin trâu.",
                    price=Decimal("3200000"),
                    address="Quận Bình Thạnh, TP.HCM",
                    lat=10.810,
                    lng=106.710,
                    score_appearance=Decimal("8.0"),
                    score_function=Decimal("9.0"),
                    score_accessories=Decimal("8.0"),
                    total_score=Decimal("8.4"),
                    status="selling",
                    created_at=now - timedelta(minutes=3),
                ),
                Listing(
                    listing_id=4,
                    seller_id=1,
                    category_id=1,
                    title="Laptop Dell XPS đã bán",
                    description="Laptop mỏng nhẹ pin tốt.",
                    price=Decimal("12000000"),
                    address="Quận 1, TP.HCM",
                    lat=10.775,
                    lng=106.700,
                    score_appearance=Decimal("8.0"),
                    score_function=Decimal("8.0"),
                    score_accessories=Decimal("8.0"),
                    total_score=Decimal("8.0"),
                    status="sold",
                    created_at=now - timedelta(minutes=4),
                ),
                Listing(
                    listing_id=5,
                    seller_id=1,
                    category_id=1,
                    title="Chuột không dây Logitech",
                    description="Phù hợp dùng cho laptop văn phòng (đang chờ duyệt).",
                    price=Decimal("350000"),
                    address="Quận 1, TP.HCM",
                    lat=10.775,
                    lng=106.700,
                    score_appearance=Decimal("7.0"),
                    score_function=Decimal("7.0"),
                    score_accessories=Decimal("7.0"),
                    total_score=Decimal("7.0"),
                    status="pending",
                    created_at=now - timedelta(minutes=5),
                ),
                Listing(
                    listing_id=6,
                    seller_id=1,
                    category_id=1,
                    title="Màn hình bị ẩn",
                    description="Màn hình dùng với laptop cực nét.",
                    price=Decimal("2500000"),
                    address="Quận 1, TP.HCM",
                    lat=10.775,
                    lng=106.700,
                    score_appearance=Decimal("7.0"),
                    score_function=Decimal("7.0"),
                    score_accessories=Decimal("7.0"),
                    total_score=Decimal("7.0"),
                    status="hidden",
                    created_at=now - timedelta(minutes=6),
                ),
                Listing(
                    listing_id=7,
                    seller_id=1,
                    category_id=1,
                    title="Bàn phím bị từ chối",
                    description="Laptop gaming bàn phím cơ.",
                    price=Decimal("500000"),
                    address="Quận 1, TP.HCM",
                    lat=10.775,
                    lng=106.700,
                    score_appearance=Decimal("6.0"),
                    score_function=Decimal("6.0"),
                    score_accessories=Decimal("6.0"),
                    total_score=Decimal("6.0"),
                    status="rejected",
                    created_at=now - timedelta(minutes=7),
                ),
                Listing(
                    listing_id=8,
                    seller_id=1,
                    category_id=2,
                    title="Áo khoác giảm 50%",
                    description="Còn mới nguyên tem, đường kính 10_cm.",
                    price=Decimal("200000"),
                    address="Quận 10, TP.HCM",
                    lat=10.772,
                    lng=106.667,
                    score_appearance=Decimal("9.0"),
                    score_function=Decimal("9.0"),
                    score_accessories=Decimal("8.0"),
                    total_score=Decimal("8.8"),
                    status="selling",
                    created_at=now - timedelta(minutes=8),
                ),
                Listing(
                    listing_id=9,
                    seller_id=1,
                    category_id=2,
                    title="Áo thun giá 50k",
                    description="Áo thun cotton thoáng mát.",
                    price=Decimal("50000"),
                    address="Quận 10, TP.HCM",
                    lat=10.772,
                    lng=106.667,
                    score_appearance=Decimal("8.0"),
                    score_function=Decimal("8.0"),
                    score_accessories=Decimal("8.0"),
                    total_score=Decimal("8.0"),
                    status="selling",
                    created_at=now - timedelta(minutes=9),
                ),
            ]
            session.add_all(base_items)
            if extra_listings:
                session.add_all(extra_listings)
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


def test_search_listings_ilike_title_and_description_case_insensitive(tmp_path):
    """
    FR-05: GET /api/listings?q=... tìm ILIKE trên title và description,
    không phân biệt hoa thường.
    """
    db_url = _setup_sqlite_db(tmp_path)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        # 1. Tìm từ khóa khớp ở title (không phân biệt hoa thường)
        res1 = client.get("/api/listings", params={"q": "macbook"})
        assert res1.status_code == 200
        data1 = res1.json()
        assert [item["id"] for item in data1] == [1]

        res1_upper = client.get("/api/listings", params={"q": "MACBOOK"})
        assert res1_upper.status_code == 200
        assert [item["id"] for item in res1_upper.json()] == [1]

        # 2. Tìm từ khóa khớp ở description (trong DB là 'LAPTOP', query là 'laptop')
        res2 = client.get("/api/listings", params={"q": "laptop"})
        assert res2.status_code == 200
        data2 = res2.json()
        assert [item["id"] for item in data2] == [2]

        # 3. Tìm từ khóa viết hoa khác với dữ liệu ('sony' vs 'SONY')
        res3 = client.get("/api/listings", params={"q": "sony"})
        assert res3.status_code == 200
        assert [item["id"] for item in res3.json()] == [3]
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_search_listings_only_returns_selling_items(tmp_path):
    """
    BR-03, TC-07: Tìm kiếm chỉ trả về tin Đang bán (status = 'selling').
    Tin pending, sold, hidden, rejected có title hoặc description khớp đều phải bị loại.
    """
    db_url = _setup_sqlite_db(tmp_path)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        # Từ khóa 'laptop' xuất hiện trong tin:
        # id=2 (selling, description)
        # id=4 (sold, title & description)
        # id=5 (pending, description)
        # id=6 (hidden, description)
        # id=7 (rejected, description)
        res = client.get("/api/listings", params={"q": "laptop"})
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 1
        assert data[0]["id"] == 2
        assert data[0]["status"] == "selling"
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_search_listings_q_exceeds_100_chars_returns_400(tmp_path):
    """
    UC-03 E1: q dài quá 100 ký tự trả HTTP 400 (chuẩn { error: { code, message, fields } })
    và không thực hiện tìm kiếm. Độ dài đúng 100 ký tự vẫn hợp lệ.
    """
    db_url = _setup_sqlite_db(tmp_path)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        # 101 ký tự -> 400
        too_long_q = "a" * 101
        res = client.get("/api/listings", params={"q": too_long_q})
        assert res.status_code == 400
        err = res.json()["error"]
        assert err["code"] == 400
        assert "100" in err["message"]
        assert "q" in err["fields"]

        # 101 khoảng trắng -> 400
        res_spaces = client.get("/api/listings", params={"q": " " * 101})
        assert res_spaces.status_code == 400
        assert res_spaces.json()["error"]["code"] == 400

        # Đúng 100 ký tự -> hợp lệ (200)
        exact_100_q = "a" * 100
        res_ok = client.get("/api/listings", params={"q": exact_100_q})
        assert res_ok.status_code == 200
        assert res_ok.json() == []
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_search_listings_max_50_results(tmp_path):
    """
    FR-05, SDD 7.2: Tìm kiếm trả tối đa 50 kết quả mỗi lần dù có nhiều hơn 50 tin khớp.
    """
    now = datetime.now(timezone.utc)
    extra = [
        Listing(
            listing_id=100 + i,
            seller_id=1,
            category_id=1,
            title=f"iPhone cũ mẫu #{i}",
            description="Điện thoại Apple chính hãng",
            price=Decimal("5000000"),
            address="TP.HCM",
            lat=10.77,
            lng=106.70,
            score_appearance=Decimal("8.0"),
            score_function=Decimal("8.0"),
            score_accessories=Decimal("8.0"),
            total_score=Decimal("8.0"),
            status="selling",
            created_at=now - timedelta(seconds=i),
        )
        for i in range(60)
    ]
    db_url = _setup_sqlite_db(tmp_path, extra_listings=extra)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        # Có 60 tin khớp 'iphone', mặc định tối đa 50 tin
        res = client.get("/api/listings", params={"q": "iphone"})
        assert res.status_code == 200
        data = res.json()
        assert len(data) == 50

        # Truyền limit=10 -> trả 10
        res_10 = client.get("/api/listings", params={"q": "iphone", "limit": 10})
        assert res_10.status_code == 200
        assert len(res_10.json()) == 10

        # Truyền limit=51 vượt giới hạn 50 -> trả 400
        res_51 = client.get("/api/listings", params={"q": "iphone", "limit": 51})
        assert res_51.status_code == 400
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_search_listings_combined_with_bbox_and_whitespace(tmp_path):
    """
    Kết hợp tham số q với bbox và xử lý khoảng trắng thừa ở hai đầu q.
    """
    db_url = _setup_sqlite_db(tmp_path)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        # BBox chỉ bao quanh Quận 1 & Quận 3 (id=1 lat 10.775, id=2 lat 10.780),
        # không bao gồm Bình Thạnh (id=3 lat 10.810)
        bbox_q1_q3 = "106.68,10.77,106.705,10.79"
        res = client.get("/api/listings", params={"q": "  laptop  ", "bbox": bbox_q1_q3})
        assert res.status_code == 200
        assert [item["id"] for item in res.json()] == [2]

        # Tìm SONY trong bbox không chứa Bình Thạnh -> rỗng
        res_outside = client.get("/api/listings", params={"q": "sony", "bbox": bbox_q1_q3})
        assert res_outside.status_code == 200
        assert res_outside.json() == []

        # q rỗng hoặc toàn khoảng trắng -> trả về các tin đang bán (không lỗi)
        res_empty = client.get("/api/listings", params={"q": "   "})
        assert res_empty.status_code == 200
        assert len(res_empty.json()) == 5  # 5 tin selling trong base_items
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_search_listings_tc12_sqli_xss_and_like_wildcards(tmp_path):
    """
    TC-12 & NFR-SEC-04:
      - Nhập chuỗi SQL Injection (' OR 1=1 --) không gây lỗi SQL và không làm lộ toàn bộ dữ liệu.
      - Nhập chuỗi XSS (<script>alert(1)</script>) không gây lỗi hay thực thi script.
      - Ký tự wildcard SQL (%, _) trong q được escape đúng nghĩa đen.
    """
    db_url = _setup_sqlite_db(tmp_path)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        # SQL injection payload
        res_sqli = client.get("/api/listings", params={"q": "' OR 1=1 --"})
        assert res_sqli.status_code == 200
        assert res_sqli.json() == []

        # XSS payload
        res_xss = client.get("/api/listings", params={"q": "<script>alert(1)</script>"})
        assert res_xss.status_code == 200
        assert res_xss.headers["content-type"].startswith("application/json")
        assert res_xss.json() == []

        # Wildcard '%' chỉ khớp tin thật sự chứa '%', không khớp tất cả
        res_pct = client.get("/api/listings", params={"q": "50%"})
        assert res_pct.status_code == 200
        assert [item["id"] for item in res_pct.json()] == [8]

        # Wildcard '_' chỉ khớp tin chứa '10_'
        res_underscore = client.get("/api/listings", params={"q": "10_"})
        assert res_underscore.status_code == 200
        assert [item["id"] for item in res_underscore.json()] == [8]
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_postgresql_ilike_sql_compilation():
    """
    Xác minh câu truy vấn biên dịch cho PostgreSQL dùng ILIKE trên title và description
    và nhóm ngoặc AND với status = 'selling'.
    """
    stmt = select(Listing).where(Listing.status == "selling")
    stmt = ListingRepository._apply_keyword_filter(stmt, "laptop")
    compiled_sql = str(stmt.compile(dialect=postgresql.dialect()))

    assert "listings.status = %(status_1)s" in compiled_sql
    assert "listings.title ILIKE %(title_1)s" in compiled_sql
    assert "listings.description ILIKE %(description_1)s" in compiled_sql
    assert "AND (listings.title ILIKE" in compiled_sql
