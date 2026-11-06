import os
import sys
from pathlib import Path
from sqlalchemy import text

# Thêm đường dẫn gốc dự án vào sys.path
sys.path.append(str(Path(__file__).resolve().parent.parent))

from app.core.database import SessionLocal


def run_seed():
    """Thực thi file SQL seed_data.sql vào cơ sở dữ liệu."""
    sql_file = Path(__file__).resolve().parent / "seed_data.sql"
    if not sql_file.exists():
        print(f"Lỗi: Không tìm thấy file {sql_file}")
        return

    print("Đang đọc và thực thi script seed dữ liệu...")
    with open(sql_file, "r", encoding="utf-8") as f:
        sql_content = f.read()

    db = SessionLocal()
    try:
        # Tách các khối lệnh SQL
        statements = [stmt.strip() for stmt in sql_content.split(";") if stmt.strip()]
        for stmt in statements:
            if stmt.upper().startswith("SET"):
                continue
            db.execute(text(stmt))
        db.commit()
        print(" Seed dữ liệu thành công:")
        print("  - Danh mục: Đã thêm các danh mục cơ bản (Nội thất, Điện tử, Sách, Quần áo...).")
        print("  - Tài khoản Admin: admin@ecofind.vn (Mật khẩu: Admin@123)")
    except Exception as e:
        db.rollback()
        print(f" Lỗi khi seed dữ liệu: {e}")
    finally:
        db.close()


if __name__ == "__main__":
    run_seed()
