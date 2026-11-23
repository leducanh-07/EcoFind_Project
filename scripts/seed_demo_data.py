"""
EcoFind Demo Data Seeder (Task TE9C75A)
Tập tin điều hướng (Forwarder/Proxy) trỏ tới bộ dữ liệu demo chuẩn tại scripts/seed_demo_listings.py.
Loại bỏ hoàn toàn code trùng lặp, đảm bảo toàn bộ hệ thống (Docker, Script, Batch) đồng nhất.
"""

import sys
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from scripts.seed_demo_listings import seed_demo


def seed_demo_data():
    """Khởi tạo trọn bộ dữ liệu demo chuẩn TP.HCM."""
    seed_demo(clean=True)


if __name__ == "__main__":
    seed_demo_data()
