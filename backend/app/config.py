from functools import lru_cache
from pathlib import Path
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict

BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(BASE_DIR / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    APP_NAME: str = "Study Buddy AI"
    APP_ENV: str = "development"
    DEBUG: bool = True
    FRONTEND_URL: str = "http://localhost:5173"
    CORS_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"
    CORS_ORIGIN_REGEX: str = ""

    JWT_SECRET_KEY: str = "study-buddy-dev-secret-change-in-production-9f4e2a"
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRE_MINUTES: int = 10080  # 7 days

    DATABASE_URL: str = f"sqlite:///{(BASE_DIR / 'data' / 'study_buddy.db').as_posix()}"
    UPLOAD_DIR: str = str(BASE_DIR / "uploads")
    CHROMA_PERSIST_DIR: str = str(BASE_DIR / "data" / "chroma_db")
    MAX_FILE_SIZE_MB: int = 25

    EMBEDDING_MODEL: str = "all-MiniLM-L6-v2"
    CHUNK_SIZE: int = 800
    CHUNK_OVERLAP: int = 150
    TOP_K_CHUNKS: int = 6
    MIN_SIMILARITY_SCORE: float = 0.12

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-3.5-flash"

    REDIS_URL: str = ""

    SMTP_HOST: str = ""
    SMTP_PORT: int = 587
    SMTP_USER: str = ""
    SMTP_PASSWORD: str = ""
    SMTP_FROM: str = ""

    @property
    def cors_origins_list(self) -> List[str]:
        return [
            origin.strip().rstrip("/")
            for origin in self.CORS_ORIGINS.split(",")
            if origin.strip()
        ]

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    def resolve_path(self, raw_path: str) -> Path:
        path = Path(raw_path)
        if not path.is_absolute():
            path = (BASE_DIR / path).resolve()
        return path

    @property
    def resolved_upload_dir(self) -> Path:
        path = self.resolve_path(self.UPLOAD_DIR)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def resolved_chroma_dir(self) -> Path:
        path = self.resolve_path(self.CHROMA_PERSIST_DIR)
        path.mkdir(parents=True, exist_ok=True)
        return path

    @property
    def resolved_database_url(self) -> str:
        url = self.DATABASE_URL
        if url.startswith("sqlite:///"):
            rel_or_abs = url[len("sqlite:///") :]
            if rel_or_abs != ":memory:":
                db_path = Path(rel_or_abs)
                if not db_path.is_absolute():
                    db_path = (BASE_DIR / db_path).resolve()
                db_path.parent.mkdir(parents=True, exist_ok=True)
                return f"sqlite:///{db_path.as_posix()}"
        return url


@lru_cache
def get_settings() -> Settings:
    return Settings()

