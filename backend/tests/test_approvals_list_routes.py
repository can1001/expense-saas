"""결재함 목록/대기건수 라우트 계약 테스트 (C9).

레거시 app/api/approvals/route.ts, app/api/approvals/pending-count/route.ts 와의
계약 정합(결재자 기준 필터·isMyTurn·페이지네이션·테넌트 격리)을 검증한다.
(test_approval_routes.py 픽스처 패턴 재사용)
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


# ── GET /api/approvals ───────────────────────────────────────────────


async def test_list_pending_returns_only_my_turn(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _create_user(client, tid, userid="leader", username="팀장A", role="team_leader")
    await _create_user(client, tid, userid="finance", username="재정팀장A", role="finance_head")

    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    await _submit(client, admin_headers, created["id"], _two_step_line("팀장A", "재정팀장A"))

    leader_headers = await _login(client, "leader", "pass1234")
    r = await client.get("/api/approvals?status=pending", headers=leader_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data["approvals"]) == 1
    item = data["approvals"][0]
    assert item["id"] == created["id"]
    assert item["isMyTurn"] is True
    assert item["approvalLine"]["currentStep"] == 1
    assert item["expense"]["applicantName"] == "관리자"
    assert item["expense"]["items"][0]["budgetDetail"] == "다과비"

    # 재정팀장(2차)은 아직 자기 차례가 아니므로 목록에 없어야 함
    finance_headers = await _login(client, "finance", "pass1234")
    r2 = await client.get("/api/approvals?status=pending", headers=finance_headers)
    assert r2.status_code == 200
    assert r2.json()["approvals"] == []


async def test_list_completed_after_approval(client: AsyncClient):
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

    r = await client.get("/api/approvals?status=completed", headers=leader_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data["approvals"]) == 1
    assert data["approvals"][0]["myStep"]["status"] == "APPROVED"
    assert data["approvals"][0]["isMyTurn"] is False  # 이제 2차 차례

    # pending 목록에서는 더이상 보이지 않아야 함
    r2 = await client.get("/api/approvals?status=pending", headers=leader_headers)
    assert r2.json()["approvals"] == []


async def test_list_pagination(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _create_user(client, tid, userid="leader", username="팀장A", role="team_leader")

    for i in range(3):
        created = await _create_expense(
            client, admin_headers, committee="선교위원회", department="1부", applicant="관리자",
            request_date="2026-03-01",
        )
        await _submit(
            client, admin_headers, created["id"],
            [{"stepNumber": 1, "stepName": "팀장", "approverName": "팀장A"}],
        )

    leader_headers = await _login(client, "leader", "pass1234")
    r = await client.get("/api/approvals?status=pending&page=1&limit=2", headers=leader_headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data["approvals"]) == 2
    assert data["pagination"] == {"page": 1, "limit": 2, "total": 3, "totalPages": 2}


async def test_list_requires_approve_permission(client: AsyncClient):
    await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _create_user(client, tid, userid="plain", username="일반사용자", role="user")

    plain_headers = await _login(client, "plain", "pass1234")
    r = await client.get("/api/approvals?status=pending", headers=plain_headers)
    assert r.status_code == 403


async def test_list_isolates_by_tenant(client: AsyncClient):
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

    # 다른 테넌트에 동명이인 결재자가 있어도 섞이지 않아야 함
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        other_tenant = Tenant(name="다른교회", subdomain="other")
        s.add(other_tenant)
        await s.flush()
        s.add(
            User(
                tenantId=other_tenant.id,
                userid="leader2",
                username="팀장A",
                password=hash_password("pass1234"),
                role="team_leader",
            )
        )
        await s.commit()

    other_headers = await _login(client, "leader2", "pass1234")
    r = await client.get("/api/approvals?status=pending", headers=other_headers)
    assert r.status_code == 200
    assert r.json()["approvals"] == []  # 동명이인이어도 다른 테넌트 데이터는 보이지 않음


# ── GET /api/approvals/pending-count ─────────────────────────────────


async def test_pending_count_reflects_my_turn_only(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _create_user(client, tid, userid="leader", username="팀장A", role="team_leader")
    await _create_user(client, tid, userid="finance", username="재정팀장A", role="finance_head")

    created = await _create_expense(
        client, admin_headers, committee="선교위원회", department="1부", applicant="관리자", request_date="2026-03-01"
    )
    await _submit(client, admin_headers, created["id"], _two_step_line("팀장A", "재정팀장A"))

    leader_headers = await _login(client, "leader", "pass1234")
    r = await client.get("/api/approvals/pending-count", headers=leader_headers)
    assert r.status_code == 200
    assert r.json() == {"count": 1}

    finance_headers = await _login(client, "finance", "pass1234")
    r2 = await client.get("/api/approvals/pending-count", headers=finance_headers)
    assert r2.status_code == 200
    assert r2.json() == {"count": 0}

    # 1차 승인 후에는 2차 결재자 카운트가 올라가야 함
    await client.post(f"/api/expenses/{created['id']}/approve", json={}, headers=leader_headers)
    r3 = await client.get("/api/approvals/pending-count", headers=finance_headers)
    assert r3.json() == {"count": 1}
    r4 = await client.get("/api/approvals/pending-count", headers=leader_headers)
    assert r4.json() == {"count": 0}


async def test_pending_count_zero_for_user_with_no_pending(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    r = await client.get("/api/approvals/pending-count", headers=admin_headers)
    assert r.status_code == 200
    assert r.json() == {"count": 0}
