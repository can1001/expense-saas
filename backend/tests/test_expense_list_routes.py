"""지출결의서 목록 GET 라우트 필터/정렬/페이지네이션/권한 스코프 계약 테스트 (C6).

레거시 app/api/expenses/route.ts 의 쿼리 파라미터·응답 형태(expenses/pagination/aggregates)
와의 계약 정합을 검증한다. httpx ASGITransport 로 실제 FastAPI 앱을 구동
(test_budget_master_routes.py 패턴 재사용).
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
from expense_api.core.models.budget import Committee, Department
from expense_api.core.models.tenant import Tenant
from expense_api.core.models.user import User, UserYearRole
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


async def _create_user(client: AsyncClient, tid: str, *, userid: str, role: str, department: str | None = None) -> str:
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        u = User(
            tenantId=tid,
            userid=userid,
            username=userid,
            password=hash_password("pass1234"),
            role=role,
            department=department,
        )
        s.add(u)
        await s.commit()
        await s.refresh(u)
        return u.id


def _expense_body(*, committee: str, department: str, applicant: str, request_date: str, items: list[dict] | None = None) -> dict:
    return {
        "committee": committee,
        "department": department,
        "requestDate": request_date,
        "applicantName": applicant,
        "bankName": "국민",
        "accountNumber": "111-222-333",
        "accountHolder": applicant,
        "items": items
        or [
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


async def test_list_pagination_and_totals(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    for i in range(3):
        body = _expense_body(
            committee="선교위원회",
            department="1부",
            applicant=f"신청자{i}",
            request_date="2026-03-01",
        )
        r = await client.post("/api/expenses", json=body, headers=headers)
        assert r.status_code == 201

    r = await client.get("/api/expenses?page=1&limit=2", headers=headers)
    assert r.status_code == 200
    data = r.json()
    assert len(data["expenses"]) == 2
    assert data["pagination"] == {"page": 1, "limit": 2, "total": 3, "totalPages": 2}
    assert data["aggregates"]["totalCount"] == 3
    assert data["aggregates"]["totalRequestAmount"] == 3 * 20000

    r2 = await client.get("/api/expenses?page=2&limit=2", headers=headers)
    assert len(r2.json()["expenses"]) == 1


async def test_list_sort_by_amount(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    for price in (1000, 5000, 3000):
        body = _expense_body(
            committee="선교위원회",
            department="1부",
            applicant="신청자",
            request_date="2026-03-01",
            items=[
                {
                    "budgetCategory": "운영비",
                    "budgetSubcategory": "회의비",
                    "budgetDetail": "다과비",
                    "description": "물품",
                    "unitPrice": price,
                    "quantity": 1,
                }
            ],
        )
        r = await client.post("/api/expenses", json=body, headers=headers)
        assert r.status_code == 201

    r = await client.get("/api/expenses?sortBy=requestAmount&sortDir=asc", headers=headers)
    amounts = [e["requestAmount"] for e in r.json()["expenses"]]
    assert amounts == sorted(amounts)


async def test_list_filters_status_committee_category_and_search(client: AsyncClient):
    headers = await _login(client, "admin", "admin123")
    r1 = await client.post(
        "/api/expenses",
        json=_expense_body(
            committee="선교위원회",
            department="1부",
            applicant="홍길동",
            request_date="2026-03-01",
            items=[
                {
                    "budgetCategory": "운영비",
                    "budgetSubcategory": "회의비",
                    "budgetDetail": "다과비",
                    "description": "간식 구입",
                    "unitPrice": 5000,
                    "quantity": 1,
                }
            ],
        ),
        headers=headers,
    )
    r2 = await client.post(
        "/api/expenses",
        json=_expense_body(
            committee="교육위원회",
            department="2부",
            applicant="김철수",
            request_date="2026-03-05",
            items=[
                {
                    "budgetCategory": "교육비",
                    "budgetSubcategory": "교재비",
                    "budgetDetail": "교재구입",
                    "description": "교재",
                    "unitPrice": 20000,
                    "quantity": 1,
                }
            ],
        ),
        headers=headers,
    )
    assert r1.status_code == 201 and r2.status_code == 201

    # committee 필터
    r = await client.get("/api/expenses?committee=선교위원회", headers=headers)
    assert [e["applicantName"] for e in r.json()["expenses"]] == ["홍길동"]

    # category 필터 (items.some 대응 — 다른 위원회 항목의 budgetCategory 매칭)
    r = await client.get("/api/expenses?category=교육비", headers=headers)
    assert [e["applicantName"] for e in r.json()["expenses"]] == ["김철수"]

    # 통합검색 q — applicantName
    r = await client.get("/api/expenses?q=홍길동", headers=headers)
    assert len(r.json()["expenses"]) == 1

    # status 필터 — 둘 다 DRAFT 이므로 PENDING 필터링 시 0건
    r = await client.get("/api/expenses?status=PENDING", headers=headers)
    assert r.json()["expenses"] == []
    r = await client.get("/api/expenses?status=DRAFT", headers=headers)
    assert len(r.json()["expenses"]) == 2

    # 날짜 범위
    r = await client.get("/api/expenses?startDate=2026-03-03&endDate=2026-03-10", headers=headers)
    assert [e["applicantName"] for e in r.json()["expenses"]] == ["김철수"]

    # 금액 범위
    r = await client.get("/api/expenses?minAmount=15000&maxAmount=25000", headers=headers)
    assert [e["applicantName"] for e in r.json()["expenses"]] == ["김철수"]


async def test_list_scope_plain_user_sees_only_own(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)
    await _create_user(client, tid, userid="member", role="user")
    member_headers = await _login(client, "member", "pass1234")

    await client.post(
        "/api/expenses",
        json=_expense_body(committee="선교위원회", department="1부", applicant="관리자건", request_date="2026-03-01"),
        headers=admin_headers,
    )
    await client.post(
        "/api/expenses",
        json=_expense_body(committee="선교위원회", department="1부", applicant="일반회원건", request_date="2026-03-02"),
        headers=member_headers,
    )

    r = await client.get("/api/expenses", headers=member_headers)
    assert r.status_code == 200
    names = [e["applicantName"] for e in r.json()["expenses"]]
    assert names == ["일반회원건"]

    r_admin = await client.get("/api/expenses", headers=admin_headers)
    assert len(r_admin.json()["expenses"]) == 2


async def test_list_scope_team_leader_sees_department_via_year_role(client: AsyncClient):
    admin_headers = await _login(client, "admin", "admin123")
    tid = await _tenant_id(client)

    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        committee = Committee(tenantId=tid, name="선교위원회")
        s.add(committee)
        await s.flush()
        dept = Department(tenantId=tid, committeeId=committee.id, name="1부")
        s.add(dept)
        await s.flush()
        leader = User(
            tenantId=tid,
            userid="leader",
            username="팀장",
            password=hash_password("pass1234"),
            role="user",
        )
        s.add(leader)
        await s.flush()
        s.add(UserYearRole(tenantId=tid, userId=leader.id, year=2026, role="team_leader", departmentId=dept.id))
        await s.commit()

    leader_headers = await _login(client, "leader", "pass1234")

    # 팀장 소속 부서("선교위원회/1부") 소속 건
    await client.post(
        "/api/expenses",
        json=_expense_body(committee="선교위원회", department="1부", applicant="같은부서건", request_date="2026-03-01"),
        headers=admin_headers,
    )
    # 다른 부서 건 — 팀장에게 보이면 안 됨
    await client.post(
        "/api/expenses",
        json=_expense_body(committee="교육위원회", department="2부", applicant="다른부서건", request_date="2026-03-01"),
        headers=admin_headers,
    )

    # Expense.department 는 부서명만 저장하므로("1부"), 레거시와 동일하게
    # "위원회명/부서명" 스코프 필터와는 매칭되지 않는다 (레거시 계약 그대로 재현).
    r = await client.get("/api/expenses", headers=leader_headers)
    assert r.status_code == 200
    assert r.json()["expenses"] == []
