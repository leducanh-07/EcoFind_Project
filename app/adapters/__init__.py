"""External service adapters package (Nominatim, ImageStorage, etc.)."""
from app.adapters.geocode_adapter import (
    BaseGeocodeAdapter,
    NominatimGeocodeAdapter,
    GeocodeAdapter,
    default_geocode_adapter,
)

__all__ = [
    "BaseGeocodeAdapter",
    "NominatimGeocodeAdapter",
    "GeocodeAdapter",
    "default_geocode_adapter",
]
