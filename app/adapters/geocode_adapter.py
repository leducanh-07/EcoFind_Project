"""
Geocode Adapters (FR-08, NFR-MNT-01, UC-05 A1).
Kiến trúc đa nguồn (SmartGeocodeAdapter):
  1. Google Maps Geocoding API (nếu GOOGLE_MAPS_API_KEY hợp lệ và đã bật Billing).
  2. ArcGIS World Geocoder (miễn phí, độ chính xác số nhà cao tại TP.HCM, hỗ trợ Suggest & Reverse).
  3. Nominatim OpenStreetMap (fallback cuối cùng, tuân thủ <= 1 req/sec & User-Agent).
Luôn ưu tiên kết quả trong phạm vi TP.HCM.
"""

from abc import ABC, abstractmethod
import asyncio
from dataclasses import dataclass
import logging
import re
import time
import unicodedata
from typing import Any, Dict, List, Optional, Tuple
import httpx

from app.core.config import settings

logger = logging.getLogger("app.adapters.geocode")

# Phạm vi địa lý TP. Hồ Chí Minh (TP.HCM)
HCMC_VIEWBOX = "106.35,11.20,107.05,10.35"  # min_lon, max_lat, max_lon, min_lat
HCMC_LAT_MIN = 10.35
HCMC_LAT_MAX = 11.20
HCMC_LON_MIN = 106.35
HCMC_LON_MAX = 107.05
HCMC_CENTER_LAT = 10.7769
HCMC_CENTER_LON = 106.7009

HCMC_KEYWORDS = (
    "hồ chí minh",
    "ho chi minh",
    "tp.hcm",
    "tp hcm",
    "tphcm",
    "sài gòn",
    "sai gon",
)


@dataclass
class GeocodeResult:
    """Kết quả định vị kèm mức độ chính xác để UI phản hồi cho người dùng."""
    lat: float
    lng: float
    matched_address: Optional[str] = None
    accuracy: str = "approximate"  # "exact" | "street" | "approximate"
    provider: str = "nominatim"


def is_coords_in_hcmc(lat: float, lon: float) -> bool:
    """Kiểm tra tọa độ có nằm trong phạm vi TP.HCM hay không."""
    return HCMC_LAT_MIN <= lat <= HCMC_LAT_MAX and HCMC_LON_MIN <= lon <= HCMC_LON_MAX


class VietnameseAddressNormalizer:
    """Chuẩn hóa địa chỉ tiếng Việt và sinh tập truy vấn tối ưu theo từng nhà cung cấp."""

    @staticmethod
    def is_alley_query(address: str) -> bool:
        """Kiểm tra người dùng có đang tìm địa chỉ hẻm/ngõ/số xuyệt hay không."""
        first_part = address.split(",")[0].strip()
        return bool(re.search(r"\b(hẻm|ngõ|ngách)\b", first_part, re.I) or "/" in first_part)

    @staticmethod
    def extract_house_number(address: str) -> Optional[int]:
        """Tách số nhà đầu chuỗi địa chỉ (nếu có)."""
        first = address.split(",")[0].strip()
        match = re.match(r"^(?:[Ss]ố\s+)?(\d+)", first)
        if not match:
            return None
        try:
            return int(match.group(1))
        except (ValueError, TypeError):
            return None

    @staticmethod
    def expand_abbreviations(address: str) -> str:
        """Mở rộng các viết tắt phổ biến Đ., P., Q., TP. thành dạng chuẩn tiếng Việt."""
        s = address.strip()
        s = re.sub(r"\b[Đđ]\.\s*", "Đường ", s)
        s = re.sub(r"\b[Pp]\.\s*", "Phường ", s)
        s = re.sub(r"\b[Qq]\.\s*", "Quận ", s)
        s = re.sub(r"^\s*[Ss]ố\s+", "", s)
        s = re.sub(r",\s*(Vietnam|Việt Nam)\s*$", "", s, flags=re.I)
        return re.sub(r"\s{2,}", " ", s).strip(" ,")

    @staticmethod
    def fold_vietnamese(text: str) -> str:
        """Chuẩn hóa chữ tiếng Việt không dấu để so khớp từ khóa ổn định."""
        s = (text or "").replace("đ", "d").replace("Đ", "d").lower()
        return "".join(
            ch for ch in unicodedata.normalize("NFKD", s)
            if not unicodedata.combining(ch)
        )

    @staticmethod
    def clean_arcgis_label(label: str) -> str:
        """Làm gọn chuỗi địa chỉ ArcGIS (bỏ mã bưu chính 5 số và ', VNM' ở cuối)."""
        cleaned = (label or "").strip()
        cleaned = re.sub(r",\s*VNM\s*$", "", cleaned, flags=re.I)
        cleaned = re.sub(r",\s*\d{5,6}\s*$", "", cleaned)
        return cleaned.strip(" ,")

    @classmethod
    def generate_arcgis_queries(cls, address: str) -> List[str]:
        """
        Sinh danh sách truy vấn cho ArcGIS theo thứ tự ưu tiên chính xác nhất:
          1. Chuỗi đã chuẩn hóa viết tắt (Đ. -> Đường ...).
          2. Bỏ tên quận/TP cũ như 'Thủ Đức' nếu đi kèm tên phường + Hồ Chí Minh
             (tránh xung đột phân cấp hành chính khiến ArcGIS rơi về Locality).
          3. Chỉ giữ '{số nhà} {tên đường}, Hồ Chí Minh' khi có phường/hẻm gây nhiễu.
        """
        cleaned = address.strip()
        if not cleaned:
            return []

        expanded = cls.expand_abbreviations(cleaned)
        queries = [expanded]

        # Bỏ token "Thành phố Thủ Đức" / "TP. Thủ Đức" / "Thủ Đức" nếu đã có từ 3 phần trở lên
        parts = [p.strip() for p in expanded.split(",") if p.strip()]
        if len(parts) >= 3:
            no_thuduc = [
                p for p in parts
                if not re.match(r"^(?:Thành phố\s+|TP\.?\s*|Quận\s+)?Thủ Đức$", p, re.I)
            ]
            if no_thuduc and len(no_thuduc) < len(parts):
                queries.append(", ".join(no_thuduc))

        # Truy vấn rút gọn số nhà + tên đường + Hồ Chí Minh
        if parts:
            street_part = parts[0]
            has_hcmc = any(kw in expanded.lower() for kw in HCMC_KEYWORDS)
            if not has_hcmc:
                queries.append(f"{expanded}, Hồ Chí Minh")
            if len(parts) >= 2:
                queries.append(f"{street_part}, Hồ Chí Minh")

        if cleaned != expanded:
            queries.append(cleaned)

        return list(dict.fromkeys(q for q in queries if q))

    @classmethod
    def generate_candidate_queries(cls, address: str) -> List[str]:
        """Sinh tập truy vấn theo thác nước cho Nominatim OpenStreetMap."""
        cleaned = address.strip()
        if not cleaned:
            return []

        s = re.sub(r"\b[Đđ]\.\s*", "", cleaned).strip()
        s = re.sub(r"^\s*[Ss]ố\s+", "", s).strip()
        s = re.sub(r"\b[Pp]\.\s*", "Phường ", s)
        s = re.sub(r"\b[Qq]\.\s*", "Quận ", s)

        parts = [p.strip() for p in s.split(",") if p.strip()]
        first_part = parts[0]
        candidates = []

        m = re.match(r"^(\d+[A-Za-z]?(?:/[0-9A-Za-z]+)?)\s+(?:Đường\s+)?(.+)$", first_part, re.I)
        if m:
            num, street = m.group(1), m.group(2).strip()
            candidates.append(f"{num} {street}, Hồ Chí Minh")
            if len(parts) > 1:
                candidates.append(f"{num} {street}, {parts[1]}, Hồ Chí Minh")
            candidates.append(f"{street}, Hồ Chí Minh")
            candidates.append(f"{num} {street}")
        else:
            candidates.append(f"{first_part}, Hồ Chí Minh")
            candidates.append(first_part)

        full_expanded = cls.expand_abbreviations(cleaned)
        candidates.extend([full_expanded, s, cleaned])

        return list(dict.fromkeys(c for c in candidates if c))


class CandidateScorer:
    """Chấm điểm các ứng viên Nominatim dựa trên loại đường, số nhà và ngữ cảnh quận/phường."""

    @staticmethod
    def score_candidate(item: Dict[str, Any], is_alley: bool, original_address: str) -> float:
        score = 0.0
        name = (item.get("name") or "").lower()
        disp = (item.get("display_name") or "").lower()
        item_type = str(item.get("type", "")).lower()
        item_class = str(item.get("class", "")).lower()

        has_hem = any(k in name or k in disp for k in ("hẻm", "ngõ", "ngách"))

        if not is_alley:
            if has_hem or item_type in ("residential", "service"):
                score -= 100.0
            if item_type in ("secondary", "primary", "tertiary", "trunk"):
                score += 50.0
        else:
            if has_hem or item_type in ("residential", "service"):
                score += 50.0

        if item_class == "building" or item_type in ("house", "building"):
            score += 80.0

        if item_class == "highway":
            if item_type in ("secondary", "primary", "trunk"):
                score += 30.0
            elif item_type == "tertiary":
                score += 20.0

        addr_details = item.get("address") or {}
        item_house = addr_details.get("house_number")
        query_house = VietnameseAddressNormalizer.extract_house_number(original_address)
        if item_house:
            if query_house is not None and str(query_house) == str(item_house).strip():
                score += 250.0
            else:
                score += 180.0

        # Thưởng điểm nếu tên phường/quận người dùng nhập xuất hiện trong display_name
        parts = [p.strip().lower() for p in original_address.split(",")[1:] if p.strip()]
        for part in parts:
            clean_part = re.sub(r"^(?:phường|quận|thành phố|tp\.?|p\.?|q\.?)\s+", "", part).strip()
            if clean_part and clean_part not in ("hồ chí minh", "việt nam", "vietnam") and clean_part in disp:
                score += 40.0

        return score


class BaseGeocodeAdapter(ABC):
    """Abstract Base Class cho Geocoding Adapters (NFR-MNT-01)."""

    @abstractmethod
    async def geocode(self, address: str) -> Optional[Tuple[float, float]]:
        """
        Tra cứu tọa độ (lat, lng) cho địa chỉ văn bản.
        Trả về (lat, lng) hoặc None nếu không tìm thấy.
        """
        pass

    async def geocode_detailed(
        self,
        address: str,
        magic_key: Optional[str] = None,
    ) -> Optional[GeocodeResult]:
        """
        Tra cứu tọa độ kèm siêu dữ liệu (matched_address, accuracy, provider).
        Cài đặt mặc định bọc lại geocode() để tương thích mọi adapter đơn giản (NFR-MNT-01).
        """
        coords = await self.geocode(address)
        if not coords:
            return None
        return GeocodeResult(lat=coords[0], lng=coords[1], provider="custom")

    async def suggest(self, query: str, limit: int = 5) -> List[Dict[str, Optional[str]]]:
        """Gợi ý địa chỉ Autocomplete (mặc định trả về rỗng)."""
        return []

    async def reverse(self, lat: float, lng: float) -> Optional[str]:
        """Chuyển đổi ngược tọa độ GPS thành địa chỉ văn bản."""
        return None


class NominatimGeocodeAdapter(BaseGeocodeAdapter):
    """
    Nominatim OpenStreetMap Geocoding Adapter.
    Tuân thủ chính sách Nominatim:
      - Gửi User-Agent hợp lệ.
      - Giới hạn tần suất <= 1 request/giây qua asyncio.Lock.
    """

    NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
    NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse"
    HCMC_VIEWBOX = HCMC_VIEWBOX
    HCMC_LAT_MIN = HCMC_LAT_MIN
    HCMC_LAT_MAX = HCMC_LAT_MAX
    HCMC_LON_MIN = HCMC_LON_MIN
    HCMC_LON_MAX = HCMC_LON_MAX

    def __init__(
        self,
        user_agent: Optional[str] = None,
        min_interval: float = 1.0,
        timeout: float = 10.0,
        base_url: Optional[str] = None,
    ):
        self.user_agent = user_agent or getattr(settings, "NOMINATIM_USER_AGENT", "EcoFindApp/1.0")
        self.min_interval = min_interval
        self.timeout = timeout
        self.base_url = base_url or self.NOMINATIM_URL
        self._lock = asyncio.Lock()
        self._last_request_time: float = 0.0

    async def _throttle(self) -> None:
        """Đảm bảo tối đa 1 request/giây khi gọi Nominatim công cộng."""
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_request_time
            if elapsed < self.min_interval:
                await asyncio.sleep(self.min_interval - elapsed)
            self._last_request_time = time.monotonic()

    def _is_in_hcmc(self, item: Dict[str, Any]) -> bool:
        """Kiểm tra ứng viên Nominatim có thuộc phạm vi TP.HCM hay không."""
        try:
            lat = float(item.get("lat", 0))
            lon = float(item.get("lon", 0))
            if is_coords_in_hcmc(lat, lon):
                return True
        except (ValueError, TypeError):
            pass

        display_name = str(item.get("display_name", "")).lower()
        if any(kw in display_name for kw in HCMC_KEYWORDS):
            return True

        address_dict = item.get("address") or {}
        for val in address_dict.values():
            if isinstance(val, str) and any(kw in val.lower() for kw in HCMC_KEYWORDS):
                return True

        if str(address_dict.get("ISO3166-2-lvl4", "")).upper() == "VN-SG":
            return True

        return False

    async def _query_nominatim(self, query: str, limit: int = 10) -> List[Dict[str, Any]]:
        """Thực hiện 1 lượt gọi HTTP GET lên Nominatim Search API (có throttle)."""
        await self._throttle()
        params = {
            "q": query,
            "format": "json",
            "addressdetails": 1,
            "limit": limit,
            "countrycodes": "vn",
            "viewbox": self.HCMC_VIEWBOX,
            "bounded": 0,
        }
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "application/json",
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(self.base_url, params=params, headers=headers)
                if response.status_code != 200:
                    logger.warning("Nominatim trả mã %s cho '%s'", response.status_code, query)
                    return []
                data = response.json()
                return data if isinstance(data, list) else []
        except Exception as exc:
            logger.warning("Lỗi kết nối Nominatim cho '%s': %s", query, exc)
            return []

    async def geocode_detailed(
        self,
        address: str,
        magic_key: Optional[str] = None,
    ) -> Optional[GeocodeResult]:
        cleaned_address = address.strip() if address else ""
        if not cleaned_address:
            return None

        is_alley = VietnameseAddressNormalizer.is_alley_query(cleaned_address)
        candidate_queries = VietnameseAddressNormalizer.generate_candidate_queries(cleaned_address)

        for query in candidate_queries:
            data = await self._query_nominatim(query, limit=10)
            if not data:
                continue

            hcmc_candidates = [it for it in data if self._is_in_hcmc(it)]
            if not hcmc_candidates:
                continue

            scored = [
                (CandidateScorer.score_candidate(item, is_alley, cleaned_address), item)
                for item in hcmc_candidates
            ]
            scored.sort(key=lambda x: x[0], reverse=True)
            best_score, best_item = scored[0]

            if best_score > -50:
                try:
                    lat = float(best_item["lat"])
                    lon = float(best_item["lon"])
                    addr_details = best_item.get("address") or {}
                    item_class = str(best_item.get("class", "")).lower()
                    item_type = str(best_item.get("type", "")).lower()

                    if addr_details.get("house_number") or item_class == "building" or item_type in ("house", "building"):
                        accuracy = "exact"
                    elif item_class == "highway":
                        accuracy = "street"
                    else:
                        accuracy = "approximate"

                    return GeocodeResult(
                        lat=lat,
                        lng=lon,
                        matched_address=best_item.get("display_name"),
                        accuracy=accuracy,
                        provider="nominatim",
                    )
                except (KeyError, ValueError, TypeError):
                    continue

        return None

    async def geocode(self, address: str) -> Optional[Tuple[float, float]]:
        result = await self.geocode_detailed(address)
        return (result.lat, result.lng) if result else None

    async def suggest(self, query: str, limit: int = 5) -> List[Dict[str, Optional[str]]]:
        cleaned = query.strip() if query else ""
        if len(cleaned) < 2:
            return []

        search_q = cleaned if any(kw in cleaned.lower() for kw in HCMC_KEYWORDS) else f"{cleaned}, Hồ Chí Minh"
        data = await self._query_nominatim(search_q, limit=min(limit * 2, 10))
        results: List[Dict[str, Optional[str]]] = []
        seen = set()

        for item in data:
            if not self._is_in_hcmc(item):
                continue
            disp = (item.get("display_name") or "").strip()
            if disp and disp not in seen:
                seen.add(disp)
                results.append({"text": disp, "magic_key": None})
            if len(results) >= limit:
                break

        return results

    async def reverse(self, lat: float, lng: float) -> Optional[str]:
        await self._throttle()
        params = {
            "lat": lat,
            "lon": lng,
            "format": "json",
            "addressdetails": 1,
        }
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "application/json",
            "Accept-Language": "vi",
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(self.NOMINATIM_REVERSE_URL, params=params, headers=headers)
                if resp.status_code != 200:
                    return None
                data = resp.json()
                if isinstance(data, dict) and data.get("display_name"):
                    return str(data["display_name"]).strip()
        except Exception as exc:
            logger.warning("Lỗi reverse geocode Nominatim: %s", exc)
        return None


class ArcGISGeocodeAdapter(BaseGeocodeAdapter):
    """
    ArcGIS World Geocoding Service Adapter (Miễn phí, không yêu cầu API key).
    Hỗ trợ định vị số nhà tiếng Việt (PointAddress), Autocomplete Suggest và Reverse Geocode.
    Chỉ chấp nhận kết quả độ chính xác từ cấp Đường trở lên (từ chối Locality/Phường/Quận chung chung).
    """

    FIND_URL = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates"
    SUGGEST_URL = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/suggest"
    REVERSE_URL = "https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/reverseGeocode"

    EXACT_ADDR_TYPES = {"PointAddress", "Subaddress", "POI"}
    STREET_ADDR_TYPES = {"StreetAddress", "StreetInt", "StreetName"}

    def __init__(self, timeout: float = 6.0):
        self.timeout = timeout

    def _classify_candidate(self, cand: Dict[str, Any]) -> Optional[Tuple[int, str]]:
        """
        Đánh giá và phân loại độ chính xác của ứng viên ArcGIS.
        Trả về (priority_rank, accuracy_label) hoặc None nếu là mức hành chính quá rộng (Locality/Admin).
        """
        loc = cand.get("location") or {}
        try:
            lat = float(loc["y"])
            lon = float(loc["x"])
        except (KeyError, TypeError, ValueError):
            return None

        if not is_coords_in_hcmc(lat, lon):
            return None

        attrs = cand.get("attributes") or {}
        addr_type = str(attrs.get("Addr_type") or "")
        score = float(cand.get("score") or attrs.get("Score") or 0.0)

        if addr_type in self.EXACT_ADDR_TYPES and score >= 78.0:
            # Ưu tiên PointAddress / Subaddress hơn POI
            rank = 3 if addr_type in ("PointAddress", "Subaddress") else 2
            return (rank, "exact")

        if addr_type in self.STREET_ADDR_TYPES and score >= 85.0:
            return (1, "street")

        return None

    async def _find_candidates(self, params: Dict[str, Any]) -> List[Dict[str, Any]]:
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(self.FIND_URL, params=params)
                if resp.status_code != 200:
                    return []
                data = resp.json()
                if not isinstance(data, dict):
                    return []
                candidates = data.get("candidates")
                return candidates if isinstance(candidates, list) else []
        except Exception as exc:
            logger.warning("Lỗi gọi ArcGIS Geocode API: %s", exc)
            return []

    async def geocode_detailed(
        self,
        address: str,
        magic_key: Optional[str] = None,
    ) -> Optional[GeocodeResult]:
        cleaned = address.strip() if address else ""
        if not cleaned:
            return None

        # 1. Nếu người dùng chọn từ dropdown Autocomplete (có magic_key): resolve trực tiếp
        if magic_key:
            candidates = await self._find_candidates({
                "SingleLine": cleaned,
                "magicKey": magic_key,
                "f": "json",
                "outFields": "Match_addr,Addr_type,Score",
            })
            for cand in candidates:
                classified = self._classify_candidate(cand)
                if classified:
                    _, accuracy = classified
                    loc = cand["location"]
                    return GeocodeResult(
                        lat=float(loc["y"]),
                        lng=float(loc["x"]),
                        matched_address=VietnameseAddressNormalizer.clean_arcgis_label(cand.get("address", cleaned)),
                        accuracy=accuracy,
                        provider="arcgis",
                    )

        # 2. Tìm theo thác nước các biến thể địa chỉ tiếng Việt (ưu tiên khớp nhiều từ khóa query nhất)
        best_street_fallback: Optional[GeocodeResult] = None
        queries = VietnameseAddressNormalizer.generate_arcgis_queries(cleaned)
        query_tokens = [
            tok for tok in re.split(r"[\s,./]+", VietnameseAddressNormalizer.fold_vietnamese(cleaned))
            if tok and tok not in ("duong", "phuong", "quan", "tp", "vietnam", "viet", "nam", "ho", "chi", "minh")
        ]

        for query in queries:
            candidates = await self._find_candidates({
                "SingleLine": query,
                "f": "json",
                "countryCode": "VNM",
                "location": f"{HCMC_CENTER_LON},{HCMC_CENTER_LAT}",
                "maxLocations": 5,
                "outFields": "Match_addr,Addr_type,Score",
            })
            if not candidates:
                continue

            ranked = []
            for cand in candidates:
                classified = self._classify_candidate(cand)
                if classified:
                    rank, accuracy = classified
                    score = float(cand.get("score") or 0.0)
                    cand_folded = VietnameseAddressNormalizer.fold_vietnamese(
                        f"{cand.get('address', '')} {(cand.get('attributes') or {}).get('Match_addr', '')}"
                    )
                    token_hits = sum(1 for tok in query_tokens if tok in cand_folded)
                    ranked.append((token_hits, rank, score, accuracy, cand))

            if not ranked:
                continue

            ranked.sort(key=lambda x: (x[0], x[1], x[2]), reverse=True)
            top_hits, top_rank, _, top_acc, top_cand = ranked[0]

            # Nếu ứng viên POI không chứa đủ từ khóa đường/địa danh (vd: 'Vincom Plaza Lê Văn Việt' lại khớp 'Vincom Plaza' ở Gò Vấp),
            # thử tìm qua Suggest API để lấy đúng magic_key chính xác
            if len(query_tokens) >= 3 and top_hits < max(2, len(query_tokens) - 1):
                sugs = await self.suggest(cleaned, limit=3)
                for s in sugs:
                    s_folded = VietnameseAddressNormalizer.fold_vietnamese(s.get("text") or "")
                    s_hits = sum(1 for tok in query_tokens if tok in s_folded)
                    if s_hits > top_hits and s.get("magic_key"):
                        mk_res = await self.geocode_detailed(s["text"], magic_key=s["magic_key"])
                        if mk_res:
                            return mk_res

            loc = top_cand["location"]
            result = GeocodeResult(
                lat=float(loc["y"]),
                lng=float(loc["x"]),
                matched_address=VietnameseAddressNormalizer.clean_arcgis_label(top_cand.get("address", "")),
                accuracy=top_acc,
                provider="arcgis",
            )

            if top_rank >= 2:
                return result

            if best_street_fallback is None:
                best_street_fallback = result

        return best_street_fallback

    async def geocode(self, address: str) -> Optional[Tuple[float, float]]:
        result = await self.geocode_detailed(address)
        return (result.lat, result.lng) if result else None

    async def suggest(self, query: str, limit: int = 5) -> List[Dict[str, Optional[str]]]:
        cleaned = query.strip() if query else ""
        if len(cleaned) < 2:
            return []

        params = {
            "text": cleaned,
            "countryCode": "VNM",
            "location": f"{HCMC_CENTER_LON},{HCMC_CENTER_LAT}",
            "maxSuggestions": min(limit * 2, 10),
            "f": "json",
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(self.SUGGEST_URL, params=params)
                if resp.status_code != 200:
                    return []
                data = resp.json()
                if not isinstance(data, dict):
                    return []
                raw_suggestions = data.get("suggestions") or []
        except Exception as exc:
            logger.warning("Lỗi gọi ArcGIS Suggest API: %s", exc)
            return []

        hcmc_items: List[Dict[str, Optional[str]]] = []
        other_items: List[Dict[str, Optional[str]]] = []
        seen = set()

        for s in raw_suggestions:
            if not isinstance(s, dict):
                continue
            raw_text = (s.get("text") or "").strip()
            clean_text = VietnameseAddressNormalizer.clean_arcgis_label(raw_text)
            if not clean_text or clean_text in seen:
                continue
            seen.add(clean_text)

            entry = {"text": clean_text, "magic_key": s.get("magicKey")}
            if any(kw in raw_text.lower() for kw in HCMC_KEYWORDS):
                hcmc_items.append(entry)
            else:
                other_items.append(entry)

        # Ưu tiên kết quả thuộc TP.HCM và khớp nhiều từ khóa người dùng gõ nhất (bỏ dấu tiếng Việt)
        combined = hcmc_items if hcmc_items else other_items
        fold = VietnameseAddressNormalizer.fold_vietnamese
        query_tokens = [t for t in re.split(r"[\s,./]+", fold(cleaned)) if t]
        if query_tokens:
            def _rank_key(entry: Dict[str, Optional[str]]) -> Tuple[int, int]:
                folded_text = fold(entry.get("text") or "")
                hits = sum(1 for tok in query_tokens if tok in folded_text)
                exact_phrase = 1 if fold(cleaned) in folded_text else 0
                return (exact_phrase, hits)

            combined.sort(key=_rank_key, reverse=True)

        return combined[:limit]

    async def reverse(self, lat: float, lng: float) -> Optional[str]:
        params = {
            "location": f"{lng},{lat}",
            "f": "json",
            "langCode": "vi",
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(self.REVERSE_URL, params=params)
                if resp.status_code != 200:
                    return None
                data = resp.json()
                if not isinstance(data, dict):
                    return None
                addr = data.get("address") or {}
                label = addr.get("LongLabel") or addr.get("Match_addr") or ""
                cleaned = VietnameseAddressNormalizer.clean_arcgis_label(str(label))
                return cleaned or None
        except Exception as exc:
            logger.warning("Lỗi gọi ArcGIS Reverse Geocode API: %s", exc)
            return None


class GoogleGeocodeAdapter(BaseGeocodeAdapter):
    """
    Google Maps Geocoding API Adapter.
    Kích hoạt khi GOOGLE_MAPS_API_KEY được cấu hình hợp lệ trong .env và đã bật Billing.
    """

    GOOGLE_GEOCODE_URL = "https://maps.googleapis.com/maps/api/geocode/json"

    def __init__(self, api_key: Optional[str] = None, timeout: float = 6.0):
        self.api_key = api_key or getattr(settings, "GOOGLE_MAPS_API_KEY", None)
        self.timeout = timeout
        self._denied_key: Optional[str] = None

    async def geocode_detailed(
        self,
        address: str,
        magic_key: Optional[str] = None,
    ) -> Optional[GeocodeResult]:
        if not self.api_key or self._denied_key == self.api_key:
            return None
        cleaned = address.strip() if address else ""
        if not cleaned:
            return None

        params = {
            "address": cleaned,
            "key": self.api_key,
            "components": "country:VN",
            "language": "vi",
        }
        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                resp = await client.get(self.GOOGLE_GEOCODE_URL, params=params)
                if resp.status_code != 200:
                    return None
                data = resp.json()
                if not isinstance(data, dict):
                    return None

                status_str = data.get("status")
                if status_str in ("REQUEST_DENIED", "OVER_QUERY_LIMIT"):
                    logger.warning(
                        "Google Geocode API trả về %s (%s); chuyển sang nguồn dự phòng.",
                        status_str,
                        data.get("error_message", ""),
                    )
                    if status_str == "REQUEST_DENIED":
                        self._denied_key = self.api_key
                    return None

                results = data.get("results") or []
                if not results:
                    return None

                top = results[0]
                geom = top.get("geometry") or {}
                loc = geom.get("location") or {}
                loc_type = geom.get("location_type", "")

                accuracy = "exact" if loc_type == "ROOFTOP" else (
                    "street" if loc_type in ("RANGE_INTERPOLATED", "GEOMETRIC_CENTER") else "approximate"
                )
                return GeocodeResult(
                    lat=float(loc["lat"]),
                    lng=float(loc["lng"]),
                    matched_address=top.get("formatted_address"),
                    accuracy=accuracy,
                    provider="google",
                )
        except Exception as exc:
            logger.warning("Lỗi gọi Google Geocode API: %s", exc)

        return None

    async def geocode(self, address: str) -> Optional[Tuple[float, float]]:
        result = await self.geocode_detailed(address)
        return (result.lat, result.lng) if result else None


class SmartGeocodeAdapter(BaseGeocodeAdapter):
    """
    Bộ điều phối Geocoding đa nguồn (NFR-MNT-01):
      1. Nếu chọn từ gợi ý có magic_key -> resolve trực tiếp qua ArcGIS.
      2. Thử Google Geocode nếu key hợp lệ (không bị REQUEST_DENIED).
      3. Thử ArcGIS PointAddress / StreetName (chính xác cao, miễn phí).
      4. Fallback sang Smart Nominatim OpenStreetMap.
    """

    def __init__(
        self,
        google_adapter: Optional[GoogleGeocodeAdapter] = None,
        arcgis_adapter: Optional[ArcGISGeocodeAdapter] = None,
        nominatim_adapter: Optional[NominatimGeocodeAdapter] = None,
    ):
        self.google_adapter = google_adapter or GoogleGeocodeAdapter()
        self.arcgis_adapter = arcgis_adapter or ArcGISGeocodeAdapter()
        self.nominatim_adapter = nominatim_adapter or NominatimGeocodeAdapter()

    async def geocode_detailed(
        self,
        address: str,
        magic_key: Optional[str] = None,
    ) -> Optional[GeocodeResult]:
        # 1. Nếu có magic_key từ Autocomplete -> giải mã chính xác qua ArcGIS
        if magic_key:
            res = await self.arcgis_adapter.geocode_detailed(address, magic_key=magic_key)
            if res:
                return res

        # 2. Ưu tiên Google Maps API nếu khả dụng
        if self.google_adapter.api_key:
            res = await self.google_adapter.geocode_detailed(address)
            if res:
                return res

        # 3. Dùng ArcGIS PointAddress / StreetName (miễn phí, định vị số nhà VN tốt)
        res = await self.arcgis_adapter.geocode_detailed(address)
        if res:
            return res

        # 4. Fallback về Nominatim OpenStreetMap
        return await self.nominatim_adapter.geocode_detailed(address)

    async def geocode(self, address: str) -> Optional[Tuple[float, float]]:
        result = await self.geocode_detailed(address)
        return (result.lat, result.lng) if result else None

    async def suggest(self, query: str, limit: int = 5) -> List[Dict[str, Optional[str]]]:
        suggestions = await self.arcgis_adapter.suggest(query, limit=limit)
        if suggestions:
            return suggestions
        return await self.nominatim_adapter.suggest(query, limit=limit)

    async def reverse(self, lat: float, lng: float) -> Optional[str]:
        addr = await self.arcgis_adapter.reverse(lat, lng)
        if addr:
            return addr
        return await self.nominatim_adapter.reverse(lat, lng)


# Alias mặc định tuân thủ NFR-MNT-01
GeocodeAdapter = SmartGeocodeAdapter
default_geocode_adapter = SmartGeocodeAdapter()
