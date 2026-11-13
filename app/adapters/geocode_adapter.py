"""
Geocode Adapter wrapping Nominatim OpenStreetMap API (FR-08, NFR-MNT-01, UC-05 A1).
Adheres to Nominatim usage policy:
  - Custom User-Agent header (from settings.NOMINATIM_USER_AGENT).
  - Rate-limited to max 1 request per second.
Prioritizes coordinates within Ho Chi Minh City (TP.HCM).
Follows NFR-MNT-01: Switching providers only requires updating this adapter.
"""

from abc import ABC, abstractmethod
import asyncio
import logging
import time
from typing import Optional, Tuple, Dict, Any, List
import httpx

from app.core.config import settings

logger = logging.getLogger("app.adapters.geocode")


class BaseGeocodeAdapter(ABC):
    """Abstract Base Class for Geocoding Adapters (NFR-MNT-01)."""

    @abstractmethod
    async def geocode(self, address: str) -> Optional[Tuple[float, float]]:
        """
        Resolve an address string to (latitude, longitude) coordinates.
        Returns (lat, lng) as floats, or None if not found or on error.
        """
        pass


class NominatimGeocodeAdapter(BaseGeocodeAdapter):
    """
    Nominatim OpenStreetMap Geocoding Adapter.
    Complies with OSM Nominatim usage policy:
      - Valid User-Agent sent with all requests.
      - Rate limit: <= 1 req/sec using asyncio lock and monotonic timestamp.
    Prioritizes results within Ho Chi Minh City (TP.HCM).
    """

    NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

    # Ho Chi Minh City (TP.HCM) geographic bounds
    HCMC_VIEWBOX = "106.35,11.20,107.05,10.35"  # left,top,right,bottom -> min_lon, max_lat, max_lon, min_lat
    HCMC_LAT_MIN = 10.35
    HCMC_LAT_MAX = 11.20
    HCMC_LON_MIN = 106.35
    HCMC_LON_MAX = 107.05

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
        """
        Enforce at most 1 request per second across concurrent callers.
        Uses asyncio.Lock and monotonic time to guarantee safety.
        """
        async with self._lock:
            now = time.monotonic()
            elapsed = now - self._last_request_time
            if elapsed < self.min_interval:
                wait_time = self.min_interval - elapsed
                await asyncio.sleep(wait_time)
            self._last_request_time = time.monotonic()

    def _is_in_hcmc(self, item: Dict[str, Any]) -> bool:
        """Check if a Nominatim result item is located in Ho Chi Minh City."""
        # 1. Coordinate check
        try:
            lat = float(item.get("lat", 0))
            lon = float(item.get("lon", 0))
            if (
                self.HCMC_LAT_MIN <= lat <= self.HCMC_LAT_MAX
                and self.HCMC_LON_MIN <= lon <= self.HCMC_LON_MAX
            ):
                return True
        except (ValueError, TypeError):
            pass

        # 2. Textual checks on display_name
        display_name = str(item.get("display_name", "")).lower()
        hcmc_keywords = [
            "hồ chí minh",
            "ho chi minh",
            "tp.hcm",
            "tp hcm",
            "tphcm",
            "sài gòn",
            "sai gon",
        ]
        if any(kw in display_name for kw in hcmc_keywords):
            return True

        # 3. Address fields check (city, state, etc.)
        address_dict = item.get("address") or {}
        for val in address_dict.values():
            if isinstance(val, str) and any(kw in val.lower() for kw in hcmc_keywords):
                return True

        # Check ISO code if present (VN-SG)
        iso_code = str(address_dict.get("ISO3166-2-lvl4", "")).upper()
        if iso_code == "VN-SG":
            return True

        return False

    async def geocode(self, address: str) -> Optional[Tuple[float, float]]:
        """
        Lookup coordinates for an address query.
        Returns (lat, lng) as floats, or None if not found or on error.
        Prioritizes results within TP.HCM.
        """
        cleaned_address = address.strip() if address else ""
        if not cleaned_address:
            return None

        # Enforce Nominatim rate limit (<= 1 request/sec)
        await self._throttle()

        params = {
            "q": cleaned_address,
            "format": "json",
            "addressdetails": 1,
            "limit": 5,
            "countrycodes": "vn",
            "viewbox": self.HCMC_VIEWBOX,
            "bounded": 0,  # Biases towards viewbox without strictly excluding others
        }
        headers = {
            "User-Agent": self.user_agent,
            "Accept": "application/json",
        }

        try:
            async with httpx.AsyncClient(timeout=self.timeout) as client:
                response = await client.get(self.base_url, params=params, headers=headers)
                if response.status_code != 200:
                    logger.warning(
                        "Nominatim returned status %s for query %s",
                        response.status_code,
                        cleaned_address,
                    )
                    return None
                data = response.json()
        except Exception as exc:
            logger.warning("Error calling Nominatim geocode API: %s", exc)
            return None

        if not isinstance(data, list) or len(data) == 0:
            return None

        # Prioritize results within TP.HCM
        for item in data:
            if self._is_in_hcmc(item):
                try:
                    return float(item["lat"]), float(item["lon"])
                except (KeyError, ValueError, TypeError):
                    continue

        # Fallback to the first valid candidate
        for item in data:
            try:
                return float(item["lat"]), float(item["lon"])
            except (KeyError, ValueError, TypeError):
                continue

        return None


# Default adapter alias conforming to NFR-MNT-01
GeocodeAdapter = NominatimGeocodeAdapter
default_geocode_adapter = NominatimGeocodeAdapter()
