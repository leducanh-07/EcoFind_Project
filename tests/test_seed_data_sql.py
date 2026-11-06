import os
import re
import bcrypt

SQL_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts", "seed_data.sql")


def test_seed_sql_file_exists():
    assert os.path.exists(SQL_FILE_PATH), f"File {SQL_FILE_PATH} does not exist."


def test_seed_sql_utf8_and_idempotency():
    with open(SQL_FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # 1. UTF-8 client encoding
    assert "client_encoding = 'UTF8'" in content or "client_encoding = 'utf8'" in content

    # 2. Idempotent check (ON CONFLICT)
    assert "ON CONFLICT" in content


def test_seed_categories_minimum_six():
    with open(SQL_FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Tìm danh sách danh mục trong VALUES của categories
    cat_match = re.search(r"INSERT INTO categories\s*\([^)]*\)\s*VALUES\s*([^;]+);", content, re.IGNORECASE)
    assert cat_match is not None, "Không tìm thấy lệnh INSERT INTO categories"

    values_str = cat_match.group(1)
    categories = re.findall(r"\('([^']+)'\)", values_str)

    # Tiêu chí: tối thiểu 6 danh mục
    assert len(categories) >= 6, f"Yêu cầu tối thiểu 6 danh mục, hiện có {len(categories)}"

    # Chứa các danh mục bắt buộc theo SRS/SDD: nội thất, điện tử, sách, quần áo
    cat_lower = [c.lower() for c in categories]
    assert any("nội thất" in c for c in cat_lower), "Thiếu danh mục Nội thất"
    assert any("điện tử" in c for c in cat_lower), "Thiếu danh mục Điện tử"
    assert any("sách" in c for c in cat_lower), "Thiếu danh mục Sách"
    assert any("quần áo" in c for c in cat_lower), "Thiếu danh mục Quần áo"


def test_seed_admin_account_and_bcrypt_hash():
    with open(SQL_FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Tìm lệnh INSERT INTO users
    user_match = re.search(r"INSERT INTO users\s*\([^)]*\)\s*VALUES\s*\(([^)]+)\)", content, re.IGNORECASE)
    assert user_match is not None, "Không tìm thấy lệnh INSERT INTO users"

    user_values = user_match.group(1)

    # 1. Kiểm tra role admin
    assert "'admin'" in user_values, "Tài khoản seed phải có role là 'admin'"

    # 2. Trích xuất bcrypt hash
    hash_match = re.search(r"'(\$2[aby]?\$[0-9]{2}\$[./A-Za-z0-9]{53})'", user_values)
    assert hash_match is not None, "Password hash không đúng định dạng bcrypt (60 ký tự)"

    admin_hash = hash_match.group(1)

    # 3. Kiểm chứng hash giải mã đúng mật khẩu Admin@123
    assert bcrypt.checkpw(b"Admin@123", admin_hash.encode("utf-8")), "Bcrypt hash không khớp với mật khẩu mẫu Admin@123"
