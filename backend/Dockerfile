# Expense SaaS 백엔드 (FastAPI) — 멀티스테이지 + uv
FROM python:3.12-slim AS base

# uv 설치
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    PYTHONUNBUFFERED=1

WORKDIR /app

# 의존성 레이어 (소스 변경과 분리해 캐시 활용)
COPY pyproject.toml uv.lock* ./
RUN uv sync --frozen --no-dev --no-install-project

# 애플리케이션 소스
COPY . .
RUN uv sync --frozen --no-dev

ENV PATH="/app/.venv/bin:$PATH"

EXPOSE 8000

# 엔트리포인트: alembic upgrade head → uvicorn
RUN chmod +x docker-entrypoint.sh
ENTRYPOINT ["./docker-entrypoint.sh"]
