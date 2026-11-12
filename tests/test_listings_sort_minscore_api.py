"""
Unit and Integration Tests for minScore Filtering & Sorting by Distance / Score
(TE9C739, STT 23, UC-03 A1 A2, FR-06, SDD 7.2).
Uses real async SQLite database via aiosqlite + PostgreSQL dialect SQL compilation verification.
"""

import asyncio
from datetime import datetime, timedelta, timezone
from decimal import Decimal
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.dialects import postgresql
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.core.database import Base, get_db
from app.core.districts import resolve_district
from app.models.category import Category
from app.models.listing import Listing
from app.models.user import User
from app.repositories.listing_repository import ListingRepository


def _setup_sqlite_db(tmp_path, extra_listings=None):
    """Tạo CSDL SQLite với các tin đăng có đa dạng điểm totalScore và khoảng cách."""
    db_file = tmp_path / "test_sort_minscore.db"
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
                email="seller_sort@ecofind.vn",
                phone="0901112233",
                password_hash="hashed_pw",
                role="user",
            )
            cat = Category(category_id=1, name="Đồ điện tử")
            session.add_all([seller, cat])

            # Tâm Quận 1: (10.7757, 106.7004)
            # Tâm Quận 3: (10.7844, 106.6844)
            items = [
                # 1. Ở đúng tâm Quận 1 (0.0 km), điểm 7.0 (biên dưới Khá/Tốt)
                Listing(
                    listing_id=1,
                    seller_id=1,
                    category_id=1,
                    title="Loa mini gần nhất điểm 7.0",
                    description="Dùng tốt",
                    price=Decimal("300000"),
                    address="10 Lê Lợi, Quận 1, TP.HCM",
                    lat=10.7757,
                    lng=106.7004,
                    score_appearance=Decimal("7.0"),
                    score_function=Decimal("7.0"),
                    score_accessories=Decimal("7.0"),
                    total_score=Decimal("7.0"),
                    status="selling",
                    created_at=now - timedelta(minutes=30),
                ),
                # 2. Cách tâm Q1 ~0.6 km, điểm 8.4 (bằng item 3 để test tie-break)
                Listing(
                    listing_id=2,
                    seller_id=1,
                    category_id=1,
                    title="Tai nghe điểm 8.4 gần",
                    description="Còn hộp",
                    price=Decimal("800000"),
                    address="20 Nguyễn Huệ, Quận 1, TP.HCM",
                    lat=10.7805,
                    lng=106.7030,
                    score_appearance=Decimal("8.4"),
                    score_function=Decimal("8.4"),
                    score_accessories=Decimal("8.4"),
                    total_score=Decimal("8.4"),
                    status="selling",
                    created_at=now - timedelta(minutes=20),
                ),
                # 3. Cách tâm Q1 ~1.2 km, điểm 8.4 (xa hơn item 2 cùng điểm 8.4)
                Listing(
                    listing_id=3,
                    seller_id=1,
                    category_id=1,
                    title="Bàn phím điểm 8.4 xa hơn",
                    description="Switch êm",
                    price=Decimal("1200000"),
                    address="30 Hai Bà Trưng, Quận 1, TP.HCM",
                    lat=10.7860,
                    lng=106.6970,
                    score_appearance=Decimal("8.4"),
                    score_function=Decimal("8.4"),
                    score_accessories=Decimal("8.4"),
                    total_score=Decimal("8.4"),
                    status="selling",
                    created_at=now - timedelta(minutes=10),
                ),
                # 4. Cách tâm Q1 ~1.7 km, điểm cao nhất 9.5 và mới nhất
                Listing(
                    listing_id=4,
                    seller_id=1,
                    category_id=1,
                    title="MacBook Pro điểm 9.5",
                    description="Như mới",
                    price=Decimal("25000000"),
                    address="50 Đinh Tiên Hoàng, Quận 1, TP.HCM",
                    lat=10.7905,
                    lng=106.7010,
                    score_appearance=Decimal("9.5"),
                    score_function=Decimal("9.5"),
                    score_accessories=Decimal("9.5"),
                    total_score=Decimal("9.5"),
                    status="selling",
                    created_at=now - timedelta(minutes=1),
                ),
                # 5. Ở Quận 3, điểm 6.9 (ngay dưới ngưỡng 7.0)
                Listing(
                    listing_id=5,
                    seller_id=1,
                    category_id=1,
                    title="Chuột không dây điểm 6.9",
                    description="Pin AA",
                    price=Decimal("150000"),
                    address="15 Võ Văn Tần, Quận 3, TP.HCM",
                    lat=10.7844,
                    lng=106.6844,
                    score_appearance=Decimal("6.9"),
                    score_function=Decimal("6.9"),
                    score_accessories=Decimal("6.9"),
                    total_score=Decimal("6.9"),
                    status="selling",
                    created_at=now - timedelta(minutes=5),
                ),
                # 6. Ở Quận 3, cách tâm Q3 ~0.8 km, điểm 4.2 (hạng Cũ)
                Listing(
                    listing_id=6,
                    seller_id=1,
                    category_id=1,
                    title="Màn hình cũ điểm 4.2",
                    description="Trầy nhẹ vỏ",
                    price=Decimal("900000"),
                    address="90 Cách Mạng Tháng 8, Quận 3, TP.HCM",
                    lat=10.7780,
                    lng=106.6880,
                    score_appearance=Decimal("4.0"),
                    score_function=Decimal("4.5"),
                    score_accessories=Decimal("4.0"),
                    total_score=Decimal("4.2"),
                    status="selling",
                    created_at=now - timedelta(minutes=40),
                ),
                # 7. Tin pending điểm 9.9 -> không bao giờ xuất hiện
                Listing(
                    listing_id=7,
                    seller_id=1,
                    category_id=1,
                    title="Tin pending điểm 9.9",
                    description="Chưa duyệt",
                    price=Decimal("5000000"),
                    address="1 Lê Lợi, Quận 1, TP.HCM",
                    lat=10.7757,
                    lng=106.7004,
                    score_appearance=Decimal("9.9"),
                    score_function=Decimal("9.9"),
                    score_accessories=Decimal("9.9"),
                    total_score=Decimal("9.9"),
                    status="pending",
                    created_at=now,
                ),
            ]
            session.add_all(items)
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


def test_min_score_filter_inclusive_and_boundaries(tmp_path):
    """
    FR-06, STT 23:
      - minScore lọc totalScore >= minScore (bao gồm dấu bằng).
      - Hỗ trợ cả minScore (camelCase SDD 7.2) và min_score (snake_case frontend).
      - Chỉ trả tin status = 'selling'.
    """
    db_url = _setup_sqlite_db(tmp_path)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        # minScore=7.0 -> giữ id=1 (7.0), id=2 (8.4), id=3 (8.4), id=4 (9.5); loại 6.9, 4.2 và pending 9.9
        res_7 = client.get("/api/listings", params={"minScore": 7.0})
        assert res_7.status_code == 200
        data_7 = res_7.json()
        assert {item["id"] for item in data_7} == {1, 2, 3, 4}
        assert all(item["totalScore"] >= 7.0 for item in data_7)

        # minScore=8.4 -> khớp chính xác giá trị 8.4 (id=2, 3, 4)
        res_84 = client.get("/api/listings", params={"minScore": 8.4})
        assert res_84.status_code == 200
        assert {item["id"] for item in res_84.json()} == {2, 3, 4}

        # min_score=9.0 (snake_case) -> chỉ id=4 (9.5)
        res_9 = client.get("/api/listings", params={"min_score": 9.0})
        assert res_9.status_code == 200
        assert [item["id"] for item in res_9.json()] == [4]

        # minScore=0.0 -> trả về tất cả 6 tin selling
        res_0 = client.get("/api/listings", params={"minScore": 0.0})
        assert res_0.status_code == 200
        assert len(res_0.json()) == 6

        # minScore=10.0 -> không có tin nào đạt 10.0
        res_10 = client.get("/api/listings", params={"minScore": 10.0})
        assert res_10.status_code == 200
        assert res_10.json() == []
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_min_score_out_of_range_and_invalid_returns_400(tmp_path):
    """Kiểm tra minScore / min_score ngoài khoảng [0, 10] hoặc NaN/chuỗi sai đều trả HTTP 400."""
    db_url = _setup_sqlite_db(tmp_path)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        for params in [
            {"minScore": -0.1},
            {"minScore": 10.1},
            {"min_score": -1},
            {"min_score": 11},
            {"minScore": "abc"},
            {"minScore": "nan"},
            {"min_score": "inf"},
        ]:
            res = client.get("/api/listings", params=params)
            assert res.status_code == 400, f"Expected 400 for {params}, got {res.status_code}"
            assert res.json()["error"]["code"] == 400
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_sort_default_is_distance_with_lat_lng(tmp_path):
    """
    STT 23: sort = distance (mặc định) sắp xếp theo khoảng cách tăng dần quanh (lat, lng).
    """
    db_url = _setup_sqlite_db(tmp_path)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        # Không truyền sort -> mặc định sort = distance
        res_default = client.get(
            "/api/listings",
            params={"lat": 10.7757, "lng": 106.7004},
        )
        assert res_default.status_code == 200
        data_default = res_default.json()
        distances = [item["distance"] for item in data_default]
        assert distances == sorted(distances)
        assert data_default[0]["id"] == 1  # Khoảng cách 0.0 km

        # Truyền sort=distance tường minh phải cho thứ tự giống hệt mặc định
        res_explicit = client.get(
            "/api/listings",
            params={"lat": 10.7757, "lng": 106.7004, "sort": "distance"},
        )
        assert res_explicit.status_code == 200
        assert [i["id"] for i in res_explicit.json()] == [i["id"] for i in data_default]
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_sort_distance_fallback_to_district_center_uc03_a1(tmp_path):
    """
    UC-03 A1, STT 23:
      - Không có lat/lng thì sắp xếp theo khoảng cách tới trung tâm khu vực đã chọn.
      - Kiểm chứng với cả Quận 1 và Quận 3: kết quả trả về distance tính từ tâm quận và tăng dần.
    """
    db_url = _setup_sqlite_db(tmp_path)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        # Chọn Quận 1 không truyền lat/lng -> tính khoảng cách từ tâm Quận 1:
        # id=1 (0.0 km) -> id=2 (~0.6 km) -> id=3 (~1.2 km) -> id=4 (~1.65 km)
        res_q1 = client.get("/api/listings", params={"district": "Quận 1"})
        assert res_q1.status_code == 200
        q1_data = res_q1.json()
        assert [item["id"] for item in q1_data] == [1, 2, 3, 4]
        assert q1_data[0]["distance"] == 0.0
        assert [item["distance"] for item in q1_data] == sorted(item["distance"] for item in q1_data)

        # Chọn Quận 3 không truyền lat/lng -> tính khoảng cách từ tâm Quận 3 (10.7844, 106.6844):
        # id=5 ở đúng tâm Q3 (0.0 km) -> id=6 (~0.81 km)
        res_q3 = client.get("/api/listings", params={"district": "Quận 3", "sort": "distance"})
        assert res_q3.status_code == 200
        q3_data = res_q3.json()
        assert [item["id"] for item in q3_data] == [5, 6]
        assert q3_data[0]["distance"] == 0.0
        assert q3_data[1]["distance"] > 0.5
        assert resolve_district("Quận 3") is not None
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_sort_by_score_descending_and_tie_breaking_uc03_a2(tmp_path):
    """
    UC-03 A2, STT 23:
      - sort = score sắp xếp theo totalScore giảm dần.
      - Khi điểm bằng nhau (8.4 ở id=2 và id=3), ưu tiên tin gần hơn trước nếu có tọa độ tâm.
      - Kết hợp được với district (không có lat/lng) vẫn trả về distance từ tâm quận.
    """
    db_url = _setup_sqlite_db(tmp_path)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        # sort=score với lat/lng tâm Q1: thứ tự điểm 9.5 (id=4) -> 8.4 gần (id=2) -> 8.4 xa (id=3) -> 7.0 (id=1) -> 6.9 (id=5) -> 4.2 (id=6)
        res = client.get(
            "/api/listings",
            params={"lat": 10.7757, "lng": 106.7004, "sort": "score"},
        )
        assert res.status_code == 200
        data = res.json()
        assert [item["id"] for item in data] == [4, 2, 3, 1, 5, 6]
        scores = [item["totalScore"] for item in data]
        assert scores == sorted(scores, reverse=True)

        # Kết hợp district='Quận 1' + minScore=8.0 + sort='SCORE' (không truyền lat/lng)
        res_a1_a2 = client.get(
            "/api/listings",
            params={"district": "Quận 1", "minScore": 8.0, "sort": "SCORE"},
        )
        assert res_a1_a2.status_code == 200
        a1_a2_data = res_a1_a2.json()
        assert [item["id"] for item in a1_a2_data] == [4, 2, 3]
        assert all(item["totalScore"] >= 8.0 for item in a1_a2_data)
        assert all(item["distance"] is not None for item in a1_a2_data)
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_sort_newest_and_invalid_sort_returns_400(tmp_path):
    """
    Kiểm tra sort=newest sắp xếp mới nhất trước và sort không hợp lệ trả về HTTP 400.
    """
    db_url = _setup_sqlite_db(tmp_path)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        res_newest = client.get("/api/listings", params={"sort": "newest"})
        assert res_newest.status_code == 200
        # Thứ tự created_at từ mới nhất -> cũ nhất: id 4 (-1m), 5 (-5m), 3 (-10m), 2 (-20m), 1 (-30m), 6 (-40m)
        assert [item["id"] for item in res_newest.json()] == [4, 5, 3, 2, 1, 6]

        for bad_sort in ["invalid", "price", "asc", "random"]:
            res_bad = client.get("/api/listings", params={"sort": bad_sort})
            assert res_bad.status_code == 400
            err = res_bad.json()["error"]
            assert err["code"] == 400
            assert "sort" in err["fields"]
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_max_50_results_with_min_score_and_sort(tmp_path):
    """
    STT 23: Tối đa 50 kết quả mỗi lần gọi kể cả khi có > 50 tin thỏa minScore,
    đồng thời lấy đúng 50 tin điểm cao nhất (khi sort=score) hoặc 50 tin gần nhất (khi sort=distance).
    """
    now = datetime.now(timezone.utc)
    extra = []
    # Tạo 60 tin selling điểm từ 7.1 đến 9.9 và khoảng cách tăng dần quanh tâm Quận 1
    for i in range(60):
        score_val = Decimal(f"{7 + (i % 3)}.{(i % 9) + 1}")  # trong [7.1, 9.9]
        extra.append(
            Listing(
                listing_id=100 + i,
                seller_id=1,
                category_id=1,
                title=f"Sản phẩm #{i}",
                description="Mô tả",
                price=Decimal("500000"),
                address="123 Lê Lợi, Quận 1, TP.HCM",
                lat=10.7757 + i * 0.001,
                lng=106.7004 + i * 0.001,
                score_appearance=score_val,
                score_function=score_val,
                score_accessories=score_val,
                total_score=score_val,
                status="selling",
                created_at=now - timedelta(minutes=i),
            )
        )

    db_url = _setup_sqlite_db(tmp_path, extra_listings=extra)
    engine = _make_client_with_sqlite(db_url)
    client = TestClient(app)
    try:
        # 1. sort=score với minScore=7.0 -> trả đúng 50 tin có điểm cao nhất giảm dần
        res_score = client.get("/api/listings", params={"minScore": 7.0, "sort": "score"})
        assert res_score.status_code == 200
        score_data = res_score.json()
        assert len(score_data) == 50
        scores = [item["totalScore"] for item in score_data]
        assert scores == sorted(scores, reverse=True)
        assert all(s >= 7.0 for s in scores)

        # 2. sort=distance mặc định với district='Quận 1' (không lat/lng, A1) -> trả đúng 50 tin gần nhất tăng dần
        res_dist = client.get("/api/listings", params={"minScore": 7.0, "district": "Quận 1"})
        assert res_dist.status_code == 200
        dist_data = res_dist.json()
        assert len(dist_data) == 50
        dists = [item["distance"] for item in dist_data]
        assert dists == sorted(dists)
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def test_postgresql_min_score_and_sort_sql_compilation():
    """
    Xác minh câu truy vấn biên dịch cho PostgreSQL gồm:
      - total_score >= minScore
      - ORDER BY total_score DESC (khi sort=score)
      - ORDER BY haversine ASC (khi sort=distance)
      - LIMIT 50
    """
    stmt_score = select(Listing).where(Listing.status == "selling", Listing.total_score >= 7.5)
    dist_expr = ListingRepository._haversine_sql(10.7757, 106.7004)
    stmt_score = stmt_score.order_by(Listing.total_score.desc(), dist_expr.asc()).limit(50)

    compiled = stmt_score.compile(dialect=postgresql.dialect())
    sql_score = str(compiled)
    assert "listings.total_score >= %(total_score_1)s" in sql_score
    assert "ORDER BY listings.total_score DESC" in sql_score
    assert "LIMIT %(" in sql_score
    assert 50 in compiled.params.values()

    stmt_dist = (
        select(Listing)
        .where(Listing.status == "selling", Listing.total_score >= 7.5)
        .order_by(dist_expr.asc(), Listing.created_at.desc())
        .limit(50)
    )
    sql_dist = str(stmt_dist.compile(dialect=postgresql.dialect()))
    assert "ORDER BY" in sql_dist
    assert "asin(sqrt(" in sql_dist
