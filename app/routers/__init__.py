"""API Routers package."""
from app.routers.health import router as health_router
from app.routers.auth import router as auth_router
from app.routers.categories import router as categories_router
from app.routers.listings import router as listings_router
from app.routers.geocode import router as geocode_router

__all__ = [
    "health_router",
    "auth_router",
    "categories_router",
    "listings_router",
    "geocode_router",
]
