from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.routers.health import router as health_router

app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="EcoFind (SecondHand Map) Backend API - 3-tier architecture adhering to IEEE Std 830 & 1016.",
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
)

# CORS Middleware configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Đăng ký router với tiền tố chuẩn /api theo SDD 7.1
app.include_router(health_router, prefix="/api")


@app.get("/", tags=["Root"])
def root():
    return {
        "message": f"Welcome to {settings.APP_NAME}",
        "docs": "/docs",
        "health": "/api/health",
    }
