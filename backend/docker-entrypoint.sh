#!/bin/sh
set -e

# 운영 마이그레이션 (앱 lifespan 에서도 실행되지만, 명시적으로 한 번 더 보장)
echo "[entrypoint] alembic upgrade head (RUNNING_ZONE=${RUNNING_ZONE})"
alembic upgrade head

echo "[entrypoint] starting uvicorn on :${PORT:-8000}"
exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8000}"
