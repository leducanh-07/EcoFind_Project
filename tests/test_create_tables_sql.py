import os
import re

SQL_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts", "create_tables.sql")


def test_sql_file_exists():
    assert os.path.exists(SQL_FILE_PATH), f"File {SQL_FILE_PATH} does not exist."


def test_sql_schema_idempotency_and_utf8():
    with open(SQL_FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Kiểm tra thiết lập UTF-8
    assert "client_encoding = 'UTF8'" in content or "client_encoding = 'utf8'" in content

    # Kiểm tra lệnh DROP CASCADE để chạy lặp lại không lỗi
    for table in ["users", "categories", "listings", "listing_photos", "favorites", "reports"]:
        assert re.search(rf"DROP TABLE IF EXISTS {table}\s+CASCADE;", content, re.IGNORECASE)


def test_sql_contains_six_tables():
    with open(SQL_FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    expected_tables = ["users", "categories", "listings", "listing_photos", "favorites", "reports"]
    for table in expected_tables:
        pattern = rf"CREATE TABLE IF NOT EXISTS {table}\s*\("
        assert re.search(pattern, content, re.IGNORECASE), f"Missing CREATE TABLE for {table}"


def test_sql_constraints_and_checks():
    with open(SQL_FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. UNIQUE email
    assert re.search(r"UNIQUE\s*\(\s*email\s*\)", content, re.IGNORECASE)

    # 2. UNIQUE tên danh mục
    assert re.search(r"UNIQUE\s*\(\s*name\s*\)", content, re.IGNORECASE)

    # 3. CHECK giá 0 - 1.000.000.000 (BR-05)
    assert re.search(r"price\s*>=\s*0\s+AND\s+price\s*<=\s*1000000000", content, re.IGNORECASE)

    # 4. CHECK 4 cột điểm 0 - 10
    assert re.search(r"score_appearance\s*>=\s*0(\.0)?\s+AND\s+score_appearance\s*<=\s*10(\.0)?", content, re.IGNORECASE)
    assert re.search(r"score_function\s*>=\s*0(\.0)?\s+AND\s+score_function\s*<=\s*10(\.0)?", content, re.IGNORECASE)
    assert re.search(r"score_accessories\s*>=\s*0(\.0)?\s+AND\s+score_accessories\s*<=\s*10(\.0)?", content, re.IGNORECASE)
    assert re.search(r"total_score\s*>=\s*0(\.0)?\s+AND\s+total_score\s*<=\s*10(\.0)?", content, re.IGNORECASE)

    # 5. CHECK status của listings: pending, selling, rejected, sold, hidden
    for st in ["pending", "selling", "rejected", "sold", "hidden"]:
        assert f"'{st}'" in content

    # 6. Khóa ngoại và quan hệ
    assert "REFERENCES users" in content
    assert "REFERENCES categories" in content
    assert "REFERENCES listings" in content

    # 7. Reports UNIQUE (reporter_id, listing_id)
    assert re.search(r"UNIQUE\s*\(\s*reporter_id\s*,\s*listing_id\s*\)", content, re.IGNORECASE)
