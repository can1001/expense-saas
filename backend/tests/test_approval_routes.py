"""결재 액션 라우트 계약 테스트 (C8).

레거시 app/api/expenses/[id]/{submit,approve,reject,withdraw,approval}/route.ts 와의
계약 정합(응답 message 필드, 결재선 조회 형태)을 검증한다.
(test_expense_write_routes.py 픽스처 패턴 재사용)
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import User
from expense_api.core.security.jwt import hash_password
from expense_api.core.security.rate_limit import _reset_all
from main import app


@pytest_asyncio.fixture
async def client():
    _reset_all()
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )

    @event.listens_for(engine.sync_engine, "connect")
    def _fk_on(dbapi_conn, _rec):
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA foreign_keys=ON")
        cur.close()

    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

    async with maker() as s:
        t = Tenant(name="데모", subdomain="demo")
        s.add(t)
        await s.flush()
        s.add(
            User(
                tenantId=t.id,
                userid="admin",
                username="관리자",
                password=hash_password("admin123"),
                role="admin",
            )
        )
        await s.commit()

    async def _override():
        async with maker() as s:
            yield s

    app.dependency_overrides[get_session] = _override
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as c:
        c._maker = maker  # type: ignore[attr-defined]
        yield c
    app.dependency_overrides.clear()
    await engine.dispose()


async def _tenant_id(client: AsyncClient) -> str:
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        row = (await s.execute(select(Tenant.id))).first()
        return row[0]


async def _login(client: AsyncClient, userid: str, password: str) -> dict:
    r = await client.post("/api/auth/login", json={"userid": userid, "password": password})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


async def _create_user(client: AsyncClient, tid: str, *, userid: str, username: str, role: str) -> str:
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        u = User(
            tenantId=tid,
            userid=userid,
            username=username,
            password=hash_password("pass1234"),
            role=role,
        )
        s.add(u)
        await s.commit()
        await s.refresh(u)
        return u.id


def _expense_body(*, committee: str, department: str, applicant: str, request_date: str) -> dict:
    return {
        "committee": committee,
        "department": department,
        "requestDate": request_date,
        "applicantName": applicant,
        "bankName": "국민",
        "accountNumber": "111-222-333",
        "accountHolder": applicant,
        "items": [
            {
                "budgetCategory": "운영비",
                "budgetSubcategory": "회의비",
                "budgetDetail": "다과비",
                "description": "간식 구입",
                "unitPrice": 10000,
                "quantity": 2,
            }
        ],
    }


async def _create_expense(client: AsyncClient, headers: dict, **kwargs) -> dict:
    r = await client.post("/api/expenses", json=_expense_body(**kwargs), headers=headers)
    assert r.status_code == 201
    return r.json()


async def _submit(client: AsyncClient, headers: dict, expense_id: str, steps: list[dict]) -> dict:
    r = await client.post(
        f"/api/expenses/{expense_id}/submit", json={"steps": steps}, headers=headers
    )
    assert r.status_code == 200
    return r.json()


def _two_step_line(leader_name: str, finance_name: str) -> list[dict]:
    return [
        {"stepNumber": 1, "stepName": "팀장", "approverName": leader_name},
        {"stepNumber": 2, "stepName": "재정팀장", "approverName": finance_name},
    ]


# ── submit ────────────────────────────────────────────────────────────


async def test_submit_creates_line_and_returns_workflow_result(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    created = await _create_expense(
        client, headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )

    r = await client.post(
        f"/api/expenses/{created['id']}/submit",
        json={"steps": [{"stepNumber": 1, "stepName": "팀장", "approverName": "관리자"}]},
        headers=headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["expenseId"] == created["id"]
    assert data["status"] == "PENDING"


# ── approve ───────────────────────────────────────────────────────────


async def test_approve_partial_level_message_includes_step_number(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _create_user(client, tid, userid="leader", username="팀장A", role="team_leader")
    await _create_user(client, tid, userid="finance", username="재정팀장A", role="finance_head")

    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    await _submit(client, admin_headers, created["id"], _two_step_line("팀장A", "재정팀장A"))

    leader_headers = await _login(client, "leader", "pass1234")
    r = await client.post(
        f"/api/expenses/{created['id']}/approve", json={}, headers=leader_headers
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "APPROVED_STEP_1"
    assert data["message"] == "1차 결재가 승인되었습니다."


async def test_approve_final_step_message_is_complete(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _create_user(client, tid, userid="leader", username="팀장A", role="team_leader")
    await _create_user(client, tid, userid="finance", username="재정팀장A", role="finance_head")

    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    await _submit(client, admin_headers, created["id"], _two_step_line("팀장A", "재정팀장A"))

    leader_headers = await _login(client, "leader", "pass1234")
    await client.post(f"/api/expenses/{created['id']}/approve", json={}, headers=leader_headers)

    finance_headers = await _login(client, "finance", "pass1234")
    r = await client.post(
        f"/api/expenses/{created['id']}/approve", json={}, headers=finance_headers
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "APPROVED_FINAL"
    assert data["message"] == "최종 승인이 완료되었습니다."


async def test_approve_non_designated_approver_forbidden(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _create_user(client, tid, userid="leader", username="팀장A", role="team_leader")
    await _create_user(client, tid, userid="other", username="다른팀장", role="team_leader")

    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    await _submit(
        client, admin_headers, created["id"],
        [{"stepNumber": 1, "stepName": "팀장", "approverName": "팀장A"}],
    )

    other_headers = await _login(client, "other", "pass1234")
    r = await client.post(
        f"/api/expenses/{created['id']}/approve", json={}, headers=other_headers
    )
    assert r.status_code == 403


# ── reject ────────────────────────────────────────────────────────────


async def test_reject_returns_fixed_message_and_status(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _create_user(client, tid, userid="leader", username="팀장A", role="team_leader")

    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    await _submit(
        client, admin_headers, created["id"],
        [{"stepNumber": 1, "stepName": "팀장", "approverName": "팀장A"}],
    )

    leader_headers = await _login(client, "leader", "pass1234")
    r = await client.post(
        f"/api/expenses/{created['id']}/reject",
        json={"comment": "예산 초과"},
        headers=leader_headers,
    )
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "REJECTED"
    assert data["message"] == "지출결의서가 반려되었습니다."


async def test_reject_without_comment_is_rejected_422(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _create_user(client, tid, userid="leader", username="팀장A", role="team_leader")

    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    await _submit(
        client, admin_headers, created["id"],
        [{"stepNumber": 1, "stepName": "팀장", "approverName": "팀장A"}],
    )

    leader_headers = await _login(client, "leader", "pass1234")
    r = await client.post(
        f"/api/expenses/{created['id']}/reject", json={"comment": ""}, headers=leader_headers
    )
    assert r.status_code == 422


# ── withdraw ──────────────────────────────────────────────────────────


async def test_withdraw_by_applicant_returns_to_draft(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    await _submit(
        client, admin_headers, created["id"],
        [{"stepNumber": 1, "stepName": "팀장", "approverName": "관리자"}],
    )

    r = await client.post(f"/api/expenses/{created['id']}/withdraw", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "DRAFT"


# ── GET approval line ────────────────────────────────────────────────


async def test_get_approval_line_returns_steps(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _create_user(client, tid, userid="leader", username="팀장A", role="team_leader")

    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    await _submit(
        client, admin_headers, created["id"],
        [{"stepNumber": 1, "stepName": "팀장", "approverName": "팀장A"}],
    )

    r = await client.get(f"/api/expenses/{created['id']}/approval", headers=admin_headers)
    assert r.status_code == 200
    data = r.json()
    assert data["expenseId"] == created["id"]
    assert data["currentStep"] == 1
    assert data["totalSteps"] == 1
    assert len(data["steps"]) == 1
    assert data["steps"][0]["approverName"] == "팀장A"


async def test_get_approval_line_nonexistent_expense_returns_404(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")

    r = await client.get("/api/expenses/nonexistent-id/approval", headers=admin_headers)
    assert r.status_code == 404
