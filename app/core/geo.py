"""
Geospatial calculation utilities (SDD 6.3, FR-06, UC-03).
Implements Haversine distance (R = 6371 km) and coarse lat/lng bounding box helpers.
"""

import math
from typing import Tuple

EARTH_RADIUS_KM = 6371.0


def haversine_km(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """
    Tính khoảng cách đường chim bay giữa hai tọa độ (đơn vị: km)
    theo công thức Haversine (SDD 6.3, R = 6371 km).
    """
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lng2 - lng1)

    a = (
        math.sin(d_phi / 2.0) ** 2
        + math.cos(phi1) * math.cos(phi2) * (math.sin(d_lambda / 2.0) ** 2)
    )
    # Kẹp giá trị [0.0, 1.0] để tránh sai số số thực khi 2 điểm trùng hoặc đối cực
    a = min(1.0, max(0.0, a))
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return EARTH_RADIUS_KM * c


def bounding_box_for_radius(
    lat: float,
    lng: float,
    radius_km: float,
) -> Tuple[float, float, float, float]:
    """
    Tính khung nhìn bao thô (min_lng, min_lat, max_lng, max_lat) quanh (lat, lng)
    với bán kính radius_km để tận dụng chỉ mục B-Tree (idx_listings_map) trước khi lọc Haversine (SDD 6.3).
    Thêm hệ số biên an toàn 0.5% tránh sót điểm nằm sát rìa bán kính do sai số làm tròn.
    """
    safety_factor = 1.005
    delta_lat = math.degrees(radius_km / EARTH_RADIUS_KM) * safety_factor

    cos_lat = max(1e-6, abs(math.cos(math.radians(lat))))
    delta_lng = min(
        180.0,
        math.degrees(radius_km / (EARTH_RADIUS_KM * cos_lat)) * safety_factor,
    )

    min_lat = max(-90.0, lat - delta_lat)
    max_lat = min(90.0, lat + delta_lat)
    min_lng = max(-180.0, lng - delta_lng)
    max_lng = min(180.0, lng + delta_lng)

    return min_lng, min_lat, max_lng, max_lat
