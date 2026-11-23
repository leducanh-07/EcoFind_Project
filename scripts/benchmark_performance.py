"""
Script benchmark hiệu năng cho EcoFind (Task TE9C757).
Kiểm thử 2 tiêu chí phi chức năng trên tập dữ liệu 10.000 tin mẫu:
- TC-02 (NFR-PER-01): Tải marker đầu tiên <= 3 giây trên kết nối mạng 4G.
- TC-03 (NFR-PER-02): Tìm kiếm / lọc trả <= 50 kết quả trong <= 2 giây.

Đo đạc 10 lần cho mỗi tiêu chí, tính Mean, Min, Max, P95 và xuất bảng kết quả.
"""

import sys
import os
import time
import json
import statistics
from pathlib import Path

# Add project root to sys.path
PROJECT_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(PROJECT_ROOT))

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

# 4G Latency simulation (Round Trip Time typical for Vietnam 4G networks: Viettel/Vinaphone ~60-80ms)
SIMULATED_4G_RTT_MS = 70.0

def run_tc02_benchmark():
    """
    TC-02: Bounding Box query cho bản đồ (Marker đầu tiên trên 4G).
    Tiêu chuẩn: <= 3000 ms (3 giây).
    Đo 10 viewport khác nhau trên các quận huyện TP.HCM.
    """
    viewports = [
        {"name": "Quận 1 (Trung tâm)", "bbox": "106.685,10.765,106.715,10.785"},
        {"name": "Bình Thạnh & Phú Nhuận", "bbox": "106.670,10.790,106.720,10.820"},
        {"name": "TP Thủ Đức (Khu Đông)", "bbox": "106.730,10.810,106.820,10.880"},
        {"name": "Quận 7 (Khu Nam)", "bbox": "106.690,10.720,106.740,10.750"},
        {"name": "Tân Bình & Tân Phú", "bbox": "106.620,10.780,106.665,10.820"},
        {"name": "Gò Vấp & Quận 12", "bbox": "106.640,10.820,106.700,10.880"},
        {"name": "Quận 5 & Quận 10", "bbox": "106.650,10.745,106.680,10.770"},
        {"name": "Bình Tân (Khu Tây)", "bbox": "106.580,10.730,106.630,10.780"},
        {"name": "Quận 8 & Bình Chánh", "bbox": "106.620,10.680,106.680,10.730"},
        {"name": "Toàn cảnh TP.HCM (Wide)", "bbox": "106.550,10.650,106.850,10.900"},
    ]

    results = []
    print("\n" + "="*80)
    print(" BẮT ĐẦU BENCHMARK TC-02: TẢI MARKER BẢN ĐỒ (NFR-PER-01, Mục tiêu <= 3.0s trên 4G)")
    print("="*80)

    for i, vp in enumerate(viewports, 1):
        params = {"bbox": vp["bbox"], "limit": 50}
        
        start = time.perf_counter()
        response = client.get("/api/listings", params=params)
        duration_ms = (time.perf_counter() - start) * 1000.0
        
        assert response.status_code == 200, f"Lỗi API: {response.text}"
        items = response.json()
        assert isinstance(items, list), f"Kết quả mong đợi dạng list nhưng nhận {type(items)}"
        
        total_time_4g_ms = duration_ms + SIMULATED_4G_RTT_MS
        passed = total_time_4g_ms <= 3000.0
        
        results.append({
            "run": i,
            "viewport": vp["name"],
            "bbox": vp["bbox"],
            "items_returned": len(items),
            "server_latency_ms": round(duration_ms, 2),
            "simulated_4g_ms": round(total_time_4g_ms, 2),
            "target_ms": 3000.0,
            "passed": passed
        })
        
        print(f"Lần {i:2d} | {vp['name']:25s} | Server: {duration_ms:6.2f} ms | 4G Est: {total_time_4g_ms:6.2f} ms | Trả: {len(items):2d} tin | {'[PASS]' if passed else '[FAIL]'}")

    return results

def run_tc03_benchmark():
    """
    TC-03: Tìm kiếm và lọc dữ liệu (NFR-PER-02).
    Tiêu chuẩn: <= 2000 ms (2 giây), trả <= 50 kết quả.
    Đo 10 kịch bản tìm kiếm và bộ lọc đa dạng trên tập 10.000 tin.
    """
    scenarios = [
        {"desc": "Từ khóa 'laptop' (Tìm kiếm toàn văn)", "params": {"q": "laptop", "limit": 50}},
        {"desc": "Danh mục 1 (Đồ điện tử) + Sắp xếp mới nhất", "params": {"category_id": 1, "sort": "newest", "limit": 50}},
        {"desc": "Từ khóa 'xe máy' + Danh mục 4 (Phương tiện)", "params": {"q": "xe máy", "category_id": 4, "limit": 50}},
        {"desc": "Điểm tình trạng >= 8.0 + Danh mục 2 (Đồ gia dụng)", "params": {"category_id": 2, "min_score": 8.0, "limit": 50}},
        {"desc": "Từ khóa 'bàn ghế' + Lọc theo Quận 1", "params": {"q": "bàn ghế", "district": "Quận 1", "limit": 50}},
        {"desc": "Danh mục 3 (Thời trang) + Sắp xếp theo điểm", "params": {"category_id": 3, "sort": "score", "limit": 50}},
        {"desc": "Từ khóa 'iphone' (Sản phẩm cụ thể)", "params": {"q": "iphone", "limit": 50}},
        {"desc": "Danh mục 5 (Sách) + Điểm tình trạng >= 7.5", "params": {"category_id": 5, "min_score": 7.5, "limit": 50}},
        {"desc": "Từ khóa 'tủ lạnh' + Lọc Bình Thạnh", "params": {"q": "tủ lạnh", "district": "Bình Thạnh", "limit": 50}},
        {"desc": "Đa tiêu chí: 'tai nghe' + Điện tử + Điểm >= 8.5", "params": {"q": "tai nghe", "category_id": 1, "min_score": 8.5, "sort": "score", "limit": 50}}
    ]

    results = []
    print("\n" + "="*80)
    print(" BẮT ĐẦU BENCHMARK TC-03: TÌM KIẾM & BỘ LỌC (NFR-PER-02, Mục tiêu <= 2.0s)")
    print("="*80)

    for i, sc in enumerate(scenarios, 1):
        start = time.perf_counter()
        response = client.get("/api/listings", params=sc["params"])
        duration_ms = (time.perf_counter() - start) * 1000.0
        
        assert response.status_code == 200, f"Lỗi API: {response.text}"
        items = response.json()
        assert isinstance(items, list), f"Kết quả mong đợi dạng list nhưng nhận {type(items)}"
        
        passed = duration_ms <= 2000.0 and len(items) <= 50
        
        results.append({
            "run": i,
            "scenario": sc["desc"],
            "params": sc["params"],
            "items_returned": len(items),
            "response_time_ms": round(duration_ms, 2),
            "target_ms": 2000.0,
            "passed": passed
        })
        
        print(f"Lần {i:2d} | {sc['desc']:50s} | Thời gian: {duration_ms:6.2f} ms | Trả: {len(items):2d} tin | {'[PASS]' if passed else '[FAIL]'}")

    return results

def compute_statistics(values):
    return {
        "min": round(min(values), 2),
        "max": round(max(values), 2),
        "mean": round(statistics.mean(values), 2),
        "median": round(statistics.median(values), 2),
        "stdev": round(statistics.stdev(values), 2) if len(values) > 1 else 0.0,
        "p95": round(statistics.quantiles(values, n=20)[18], 2) if len(values) >= 5 else round(max(values), 2)
    }

def main():
    print("KHỞI TẠO KIỂM THỬ HIỆU NĂNG VỚI 10.000 TIN MẪU TẠI TP.HCM...")
    
    # Run TC-02
    tc02_results = run_tc02_benchmark()
    tc02_server_times = [r["server_latency_ms"] for r in tc02_results]
    tc02_4g_times = [r["simulated_4g_ms"] for r in tc02_results]
    tc02_stats = compute_statistics(tc02_4g_times)
    tc02_server_stats = compute_statistics(tc02_server_times)

    # Run TC-03
    tc03_results = run_tc03_benchmark()
    tc03_times = [r["response_time_ms"] for r in tc03_results]
    tc03_stats = compute_statistics(tc03_times)

    # Summary
    print("\n" + "="*80)
    print(" TỔNG HỢP KẾT QUẢ ĐO LƯỜNG HIỆU NĂNG (10 LẦN)")
    print("="*80)
    print("1. TC-02 (Tải marker bản đồ trên 4G - Tiêu chuẩn <= 3000 ms):")
    print(f"   - Server Time (ms): Min={tc02_server_stats['min']} | Max={tc02_server_stats['max']} | Mean={tc02_server_stats['mean']} | P95={tc02_server_stats['p95']}")
    print(f"   - 4G Latency  (ms): Min={tc02_stats['min']} | Max={tc02_stats['max']} | Mean={tc02_stats['mean']} | P95={tc02_stats['p95']}")
    print(f"   - Đánh giá: {'ĐẠT (PASS) 100%' if all(r['passed'] for r in tc02_results) else 'KHÔNG ĐẠT'}")

    print("\n2. TC-03 (Tìm kiếm và bộ lọc với 10k tin - Tiêu chuẩn <= 2000 ms, trả <= 50 tin):")
    print(f"   - Response Time (ms): Min={tc03_stats['min']} | Max={tc03_stats['max']} | Mean={tc03_stats['mean']} | P95={tc03_stats['p95']}")
    print(f"   - Đánh giá: {'ĐẠT (PASS) 100%' if all(r['passed'] for r in tc03_results) else 'KHÔNG ĐẠT'}")

    # Output JSON summary for docs
    output = {
        "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
        "total_records": 10000,
        "tc02": {
            "test_case": "TC-02",
            "nfr": "NFR-PER-01",
            "threshold_ms": 3000.0,
            "simulated_network": "4G (RTT +70ms)",
            "runs": tc02_results,
            "statistics_4g": tc02_stats,
            "statistics_server": tc02_server_stats,
            "passed": all(r["passed"] for r in tc02_results)
        },
        "tc03": {
            "test_case": "TC-03",
            "nfr": "NFR-PER-02",
            "threshold_ms": 2000.0,
            "max_items": 50,
            "runs": tc03_results,
            "statistics": tc03_stats,
            "passed": all(r["passed"] for r in tc03_results)
        }
    }

    report_path = PROJECT_ROOT / "docs" / "benchmark_results.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    print(f"\n[OK] Đã lưu kết quả chi tiết vào: {report_path}")

if __name__ == "__main__":
    main()
