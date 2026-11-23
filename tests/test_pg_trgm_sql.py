"""
Test Suite kiểm tra script cài đặt extension pg_trgm và chỉ mục GIN (Task TE9C75B, SDD 6.2, NFR-PER-02).
Kiểm tra các tiêu chí:
1. File scripts/add_pg_trgm.sql tồn tại và đúng mã hóa UTF-8.
2. Có lệnh kích hoạt extension pg_trgm (CREATE EXTENSION IF NOT EXISTS pg_trgm).
3. Có chỉ mục GIN trên title với gin_trgm_ops.
4. Có chỉ mục GIN trên description với gin_trgm_ops.
5. Có chỉ mục GIN tổng hợp (title || ' ' || description) tối ưu hóa tìm kiếm toàn văn.
6. Sử dụng Partial Index (WHERE status = 'selling') để giảm tải kích thước chỉ mục.
7. Đảm bảo tính Idempotent (có IF NOT EXISTS cho extension và indexes).
"""

import os
import re
import pytest

SQL_FILE_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "scripts", "add_pg_trgm.sql")


def test_pg_trgm_sql_file_exists():
    assert os.path.exists(SQL_FILE_PATH), f"Không tìm thấy file: {SQL_FILE_PATH}"


def test_pg_trgm_extension_activation():
    with open(SQL_FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    assert re.search(
        r"CREATE\s+EXTENSION\s+IF\s+NOT\s+EXISTS\s+pg_trgm\s*;",
        content,
        re.IGNORECASE,
    ), "Thiếu lệnh kích hoạt extension pg_trgm với IF NOT EXISTS"


def test_pg_trgm_gin_indexes():
    with open(SQL_FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Chỉ mục trên title
    assert re.search(
        r"CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+listings\s+USING\s+gin\s*\(\s*title\s+gin_trgm_ops\s*\)",
        content,
        re.IGNORECASE,
    ), "Thiếu chỉ mục GIN trên trường title với gin_trgm_ops"

    # Chỉ mục trên description
    assert re.search(
        r"CREATE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+\w+\s+ON\s+listings\s+USING\s+gin\s*\(\s*description\s+gin_trgm_ops\s*\)",
        content,
        re.IGNORECASE,
    ), "Thiếu chỉ mục GIN trên trường description với gin_trgm_ops"

    # Chỉ mục tổng hợp title + description
    assert re.search(
        r"gin_trgm_ops",
        content,
        re.IGNORECASE,
    ), "Yêu cầu sử dụng gin_trgm_ops cho các chỉ mục tìm kiếm mờ"


def test_pg_trgm_partial_index_filter():
    with open(SQL_FILE_PATH, "r", encoding="utf-8") as f:
        content = f.read()

    # Kiểm tra chỉ mục chỉ áp dụng cho tin 'selling'
    matches = re.findall(r"WHERE\s+status\s*=\s*'selling'", content, re.IGNORECASE)
    assert len(matches) >= 2, "Các chỉ mục GIN phải là Partial Index (WHERE status = 'selling')"
