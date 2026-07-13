"""Expense SaaS API — FastAPI 진입점 (Phase 0 스캐폴딩).

기동 순서 (su-membership-backend lifespan 패턴):
  1) require_running_zone()  — settings 로드보다 먼저, zone 미설정 시 부팅 거부
  2) run_migrations_async()  — alembic upgrade head
  3) _boot_validation()      — prod 안전장치
"""

# ── (1) zone 가드: 반드시 settings/엔진 import 보다 먼저 ──────────────
from expense_api.core.db.guard import require_running_zone

require_running_zone()

import sys  # noqa: E402
from contextlib import asynccontextmanager  # noqa: E402

from fastapi import FastAPI  # noqa: E402
from fastapi.middleware.cors import CORSMiddleware  # noqa: E402

from expense_api.core.config.settings import settings  # noqa: E402
from expense_api.core.db.migrations import run_migrations_async  # noqa: E402
from expense_api.core.db.seed import seed_if_needed  # noqa: E402
from expense_api.core.routes import (  # noqa: E402
    approval_policy_routes,
    approval_routes,
    auth_routes,
    budget_master_routes,
    budget_routes,
    expense_routes,
    health_routes,
    tenant_routes,
)


def _boot_validation() -> None:
    """운영(prod) 부팅 시 위험한 설정을 차단한다."""
    if not settings.is_prod:
        return
    problems: list[str] = []
    if settings.is_sqlite:
        problems.append("prod 에서 SQLite DATABASE_URL 사용 금지")
    if settings.SECRET_KEY in (
        "dev-only-change-me",
        "local-dev-secret-not-for-prod",
        "change-me-in-prod",
    ):
        problems.append("prod 에서 기본 SECRET_KEY 사용 금지")
    if problems:
        print("FATAL boot validation:\n  - " + "\n  - ".join(problems), file=sys.stderr)
        sys.exit(1)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await run_migrations_async()  # alembic upgrade head
    _boot_validation()
    await seed_if_needed()  # local zone 데모 시드 (idempotent)
    yield


app = FastAPI(title="Expense SaaS API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 라우터 등록
app.include_router(health_routes.router, tags=["health"])
app.include_router(auth_routes.router, prefix="/api/auth", tags=["auth"])
app.include_router(tenant_routes.router, prefix="/api/tenant", tags=["tenant"])
app.include_router(budget_routes.router, prefix="/api/budget", tags=["budget"])
app.include_router(budget_master_routes.router, prefix="/api", tags=["budget-master"])
app.include_router(expense_routes.router, prefix="/api/expenses", tags=["expenses"])
app.include_router(approval_routes.router, prefix="/api/expenses", tags=["approval"])
app.include_router(approval_policy_routes.router, prefix="/api", tags=["approval-policy"])
