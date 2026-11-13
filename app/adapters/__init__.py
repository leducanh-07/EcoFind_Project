"""External service adapters package (Nominatim, ImageStorage, etc.)."""
from app.adapters.geocode_adapter import (
    BaseGeocodeAdapter,
    NominatimGeocodeAdapter,
    GeocodeAdapter,
    default_geocode_adapter,
)
from app.adapters.image_storage_adapter import (
    BaseImageStorageAdapter,
    LocalImageStorageAdapter,
    CloudinaryImageStorageAdapter,
    ImageStorageAdapter,
    default_image_storage_adapter,
    validate_image_file,
    process_and_save_upload_files,
    ALLOWED_IMAGE_EXTENSIONS,
    ALLOWED_IMAGE_MIME_TYPES,
    MAX_IMAGE_SIZE_BYTES,
    MAX_IMAGE_COUNT,
)

__all__ = [
    "BaseGeocodeAdapter",
    "NominatimGeocodeAdapter",
    "GeocodeAdapter",
    "default_geocode_adapter",
    "BaseImageStorageAdapter",
    "LocalImageStorageAdapter",
    "CloudinaryImageStorageAdapter",
    "ImageStorageAdapter",
    "default_image_storage_adapter",
    "validate_image_file",
    "process_and_save_upload_files",
    "ALLOWED_IMAGE_EXTENSIONS",
    "ALLOWED_IMAGE_MIME_TYPES",
    "MAX_IMAGE_SIZE_BYTES",
    "MAX_IMAGE_COUNT",
]
