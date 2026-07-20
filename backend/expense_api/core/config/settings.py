"""애플리케이션 설정.

RUNNING_ZONE 값에 따라 .env.{zone} 파일을 로드하고,
DATABASE_URL 기본값 자체가 zone 조건부(SQLite/Postgres)로 갈린다.
(spec_python_refactoring.md §5.1 — 3-Layer Fallback)
"""

import os
from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


def _env_file() -> str:
    """RUNNING_ZONE 에 대응하는 .env 파일 경로. (예: local → .env.local)"""
    zone = os.getenv("RUNNING_ZONE", "local")
    return f".env.{zone}"


def _default_database_url() -> str:
    """zone 조건부 기본 DATABASE_URL. .env 에 값이 있으면 그것이 우선한다."""
    zone = os.getenv("RUNNING_ZONE", "local")
    if zone == "local":
        return "sqlite+aiosqlite:///./dev.db"
    return "postgresql+asyncpg://user:password@localhost:5432/expense"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=_env_file(),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # 실행 존
    RUNNING_ZONE: str = "local"

    # 데이터베이스
    DATABASE_URL: str = _default_database_url()

    # JWT
    # ⚠️ 상호호환: SECRET_KEY 는 Next.js USER_JWT_SECRET 과 동일해야 토큰이 상호 검증된다.
    #    (로컬 개발 기본값은 Next.js dev 폴백과 일치시켜 크로스 로그인 가능)
    SECRET_KEY: str = "dev-only-change-me"
    JWT_ALGORITHM: str = "HS256"
    JWT_ISSUER: str = "expense-saas"  # Next.js setIssuer 와 일치
    JWT_AUDIENCE: str = "tenant-user"  # Next.js setAudience 와 일치
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    # 플랫폼(SuperAdmin) JWT — 일반 사용자 세션과 분리된 별도 시크릿 (lib/auth/super-admin.ts 대응)
    SUPER_ADMIN_JWT_SECRET: str = "dev-only-super-admin-secret-change-me"

    # CORS
    CORS_ORIGINS: list[str] = ["http://localhost:3002"]

    # 카카오 로그인 (A6) — 미설정이면 kakao_service 가 503 으로 안내
    KAKAO_REST_API_KEY: str | None = None
    KAKAO_USE_OIDC: bool = False

    # Cloudinary 이미지 업로드 (B2) — 미설정이면 cloudinary_service 가 503 으로 안내
    CLOUDINARY_CLOUD_NAME: str | None = None
    CLOUDINARY_API_KEY: str | None = None
    CLOUDINARY_API_SECRET: str | None = None

    # 자동이체 크론잡 인증 시크릿 (B6) — /api/recurring-expenses/process
    CRON_SECRET: str | None = None

    # 웹 푸시 (N1) — 미설정이면 vapid-public-key 가 503 으로 안내
    VAPID_PUBLIC_KEY: str | None = None
    VAPID_PRIVATE_KEY: str | None = None
    VAPID_SUBJECT: str = "mailto:admin@example.com"

    # FCM (N2) — 미설정이면 fcm-test 가 503 으로 안내
    FIREBASE_SERVICE_ACCOUNT_JSON: str | None = None

    @property
    def is_sqlite(self) -> bool:
        return self.DATABASE_URL.startswith("sqlite")

    @property
    def is_prod(self) -> bool:
        return self.RUNNING_ZONE == "prod"


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
