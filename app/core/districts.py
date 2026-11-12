"""
District Center Lookup Table & Address Matching Helpers (TE9C738, STT 22, FR-06, SDD 6.3, UC-03 A1).
Provides center coordinates (lat, lng) and matching aliases for Ho Chi Minh City districts.
"""

from dataclasses import dataclass
import re
from typing import Dict, List, Optional, Tuple
import unicodedata


@dataclass(frozen=True)
class DistrictInfo:
    """Thông tin chuẩn hóa của một khu vực (quận/huyện/TP)."""
    name: str
    lat: float
    lng: float
    aliases: Tuple[str, ...]


# Bảng tọa độ trung tâm các quận/huyện/TP.Thủ Đức tại TP.HCM
HCMC_DISTRICTS: Tuple[DistrictInfo, ...] = (
    DistrictInfo("Quận 1", 10.7757, 106.7004, ("Quận 1", "Q.1", "Q1", "Q 1")),
    DistrictInfo("Quận 2", 10.7873, 106.7498, ("Quận 2", "Q.2", "Q2", "Q 2")),
    DistrictInfo("Quận 3", 10.7844, 106.6844, ("Quận 3", "Q.3", "Q3", "Q 3")),
    DistrictInfo("Quận 4", 10.7578, 106.7013, ("Quận 4", "Q.4", "Q4", "Q 4")),
    DistrictInfo("Quận 5", 10.7540, 106.6634, ("Quận 5", "Q.5", "Q5", "Q 5")),
    DistrictInfo("Quận 6", 10.7481, 106.6352, ("Quận 6", "Q.6", "Q6", "Q 6")),
    DistrictInfo("Quận 7", 10.7340, 106.7216, ("Quận 7", "Q.7", "Q7", "Q 7")),
    DistrictInfo("Quận 8", 10.7241, 106.6286, ("Quận 8", "Q.8", "Q8", "Q 8")),
    DistrictInfo("Quận 9", 10.8428, 106.8287, ("Quận 9", "Q.9", "Q9", "Q 9")),
    DistrictInfo("Quận 10", 10.7746, 106.6680, ("Quận 10", "Q.10", "Q10", "Q 10")),
    DistrictInfo("Quận 11", 10.7628, 106.6501, ("Quận 11", "Q.11", "Q11", "Q 11")),
    DistrictInfo("Quận 12", 10.8672, 106.6413, ("Quận 12", "Q.12", "Q12", "Q 12")),
    DistrictInfo("Bình Thạnh", 10.8106, 106.7091, ("Bình Thạnh",)),
    DistrictInfo("Tân Bình", 10.8015, 106.6526, ("Tân Bình",)),
    DistrictInfo("Tân Phú", 10.7900, 106.6282, ("Tân Phú",)),
    DistrictInfo("Phú Nhuận", 10.7992, 106.6803, ("Phú Nhuận",)),
    DistrictInfo("Gò Vấp", 10.8387, 106.6653, ("Gò Vấp",)),
    DistrictInfo("Bình Tân", 10.7652, 106.6038, ("Bình Tân",)),
    DistrictInfo(
        "TP. Thủ Đức",
        10.8494,
        106.7537,
        ("TP. Thủ Đức", "TP Thủ Đức", "Thành phố Thủ Đức", "Thủ Đức"),
    ),
    DistrictInfo("Bình Chánh", 10.6874, 106.5939, ("Bình Chánh",)),
    DistrictInfo("Nhà Bè", 10.6953, 106.7049, ("Nhà Bè",)),
    DistrictInfo("Hóc Môn", 10.8862, 106.5954, ("Hóc Môn",)),
    DistrictInfo("Củ Chi", 10.9733, 106.4933, ("Củ Chi",)),
    DistrictInfo("Cần Giờ", 10.4112, 106.9547, ("Cần Giờ",)),
)


def _normalize_key(text: str) -> str:
    """Chuẩn hóa chuỗi phục vụ tra cứu quận (bỏ dấu tiếng Việt, thường hóa, gom khoảng trắng)."""
    replaced = text.replace("đ", "d").replace("Đ", "D")
    nfd = unicodedata.normalize("NFD", replaced)
    no_marks = "".join(ch for ch in nfd if unicodedata.category(ch) != "Mn")
    cleaned = re.sub(r"[.\s]+", " ", no_marks.strip().lower())
    return cleaned


def _build_district_index() -> Dict[str, DistrictInfo]:
    index: Dict[str, DistrictInfo] = {}
    for info in HCMC_DISTRICTS:
        index[_normalize_key(info.name)] = info
        for alias in info.aliases:
            index[_normalize_key(alias)] = info
            # Hỗ trợ dạng bỏ dấu cách giữa Q và số (ví dụ "q.1" -> "q1")
            compact = _normalize_key(alias).replace(" ", "")
            index[compact] = info
        # Hỗ trợ thêm dạng "quan binh thanh", "huyen binh chanh", ...
        if not info.name.startswith("Quận") and not info.name.startswith("TP."):
            index[_normalize_key(f"Quận {info.name}")] = info
            index[_normalize_key(f"Huyện {info.name}")] = info
    return index


DISTRICT_CENTERS: Dict[str, DistrictInfo] = _build_district_index()


def resolve_district(district: Optional[str]) -> Optional[DistrictInfo]:
    """
    Tra cứu thông tin tọa độ trung tâm của quận/khu vực từ DISTRICT_CENTERS.
    Trả về None nếu không nằm trong danh sách TP.HCM định sẵn.
    """
    if not district or not district.strip():
        return None
    key = _normalize_key(district)
    return DISTRICT_CENTERS.get(key) or DISTRICT_CENTERS.get(key.replace(" ", ""))


def get_district_search_terms(district: str) -> List[str]:
    """
    Trả về danh sách các từ khóa tên khu vực dùng để khớp trong cột address.
    Nếu thuộc bảng DISTRICT_CENTERS thì trả về đầy đủ alias chuẩn; ngược lại trả về chuỗi gốc.
    """
    info = resolve_district(district)
    if info:
        return list(info.aliases)
    return [district.strip()]


def address_matches_district(address: Optional[str], district: Optional[str]) -> bool:
    """
    Kiểm tra chính xác chuỗi address có khớp với khu vực district hay không,
    tránh trường hợp 'Quận 1' khớp nhầm vào 'Quận 10', 'Quận 11', 'Quận 12'.
    """
    if not district or not district.strip():
        return True
    if not address:
        return False

    terms = get_district_search_terms(district)
    for term in terms:
        if term and term[-1].isdigit():
            pattern = rf"(?:^|[\s,.;/(\-]){re.escape(term)}(?:$|[\s,.;/)\-])"
        else:
            pattern = rf"(?:^|[\s,.;/(\-]){re.escape(term)}(?:$|[\s,.;/)\-])"
        if re.search(pattern, address, flags=re.IGNORECASE):
            return True
    return False
