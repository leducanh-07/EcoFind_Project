import os
from typing import List

try:
    from pydantic_settings import BaseSettings, SettingsConfigDict

    class Settings(BaseSettings):
        APP_NAME: str = "EcoFind API"
        APP_ENV: str = "development"
        APP_PORT: int = 8000
        DEBUG: bool = True

        # Database
        DB_HOST: str = "localhost"
        DB_PORT: int = 5432
        DB_USER: str = "postgres"
        DB_PASSWORD: str = "postgres"
        DB_NAME: str = "ecofind_db"

        # Security
        JWT_SECRET_KEY: str = "default_insecure_jwt_secret_key_change_me"
        JWT_ALGORITHM: str = "HS256"
        ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440

        # External Adapters
        NOMINATIM_USER_AGENT: str = "EcoFindApp/1.0"

        # CORS
        CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

        @property
        def database_url(self) -> str:
            return f"postgresql+psycopg2://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"

        model_config = SettingsConfigDict(
            env_file=".env",
            env_file_encoding="utf-8",
            extra="ignore",
        )

except ImportError:
    from pydantic import BaseModel

    class Settings(BaseModel):
        APP_NAME: str = os.getenv("APP_NAME", "EcoFind API")
        APP_ENV: str = os.getenv("APP_ENV", "development")
        APP_PORT: int = int(os.getenv("APP_PORT", "8000"))
        DEBUG: bool = os.getenv("DEBUG", "True").lower() in ("true", "1", "yes")

        # Database
        DB_HOST: str = os.getenv("DB_HOST", "localhost")
        DB_PORT: int = int(os.getenv("DB_PORT", "5432"))
        DB_USER: str = os.getenv("DB_USER", "postgres")
        DB_PASSWORD: str = os.getenv("DB_PASSWORD", "postgres")
        DB_NAME: str = os.getenv("DB_NAME", "ecofind_db")

        # Security
        JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "default_insecure_jwt_secret_key_change_me")
        JWT_ALGORITHM: str = os.getenv("JWT_ALGORITHM", "HS256")
        ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

        # External Adapters
        NOMINATIM_USER_AGENT: str = os.getenv("NOMINATIM_USER_AGENT", "EcoFindApp/1.0")

        # CORS
        CORS_ORIGINS: List[str] = ["http://localhost:3000", "http://localhost:5173"]

        @property
        def database_url(self) -> str:
            return f"postgresql+psycopg2://{self.DB_USER}:{self.DB_PASSWORD}@{self.DB_HOST}:{self.DB_PORT}/{self.DB_NAME}"


settings = Settings()
