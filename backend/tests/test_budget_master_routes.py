"""예산 마스터 GET 목록 라우트 계약 테스트 (C4 — committees/departments/budget-categories/subcategories).

레거시 Next.js 응답 형태(leader/_count/committeeName/leaderName 등)와의 계약 정합을 검증한다.
httpx ASGITransport 로 실제 FastAPI 앱을 구동 (test_auth_routes.py 패턴 재사용).
"""

import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.db.session import get_session
from expense_api.core.models.budget import (
    BudgetCategory,
    BudgetSubcategory,
    Committee,
    Department,
)
from expense_api.core.models.ids import utcnow
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


async def _login(client: AsyncClient) -> dict:
    r = await client.post("/api/auth/login", json={"userid": "admin", "password": "admin123"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


async def _tenant_id(client: AsyncClient) -> str:
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        from sqlalchemy import select

        row = (await s.execute(select(Tenant.id))).first()
        return row[0]


async def test_list_committees_includes_leader_and_department_count(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    maker = client._maker  # type: ignore[attr-defined]

    async with maker() as s:
        leader = User(tenantId=tid, userid="leader1", username="리더1", role="user")
        s.add(leader)
        await s.flush()
        c1 = Committee(tenantId=tid, name="기획본부", sortOrder=1, leaderId=leader.id)
        c2 = Committee(tenantId=tid, name="사업본부", sortOrder=2)
        s.add_all([c1, c2])
        await s.flush()
        s.add(Department(tenantId=tid, committeeId=c1.id, name="재정팀", sortOrder=1))
        s.add(Department(tenantId=tid, committeeId=c1.id, name="총무팀", sortOrder=2))
        await s.commit()

    r = await client.get("/api/committees", headers=headers)
    assert r.status_code == 200
    committees = r.json()["committees"]
    assert len(committees) == 2

    c1_data = next(c for c in committees if c["name"] == "기획본부")
    assert c1_data["leader"] == {"id": leader.id, "username": "리더1"}
    assert c1_data["_count"] == {"departments": 2}

    c2_data = next(c for c in committees if c["name"] == "사업본부")
    assert c2_data["leader"] is None
    assert c2_data["_count"] == {"departments": 0}


async def test_list_departments_includes_committee_and_leader_names(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    maker = client._maker  # type: ignore[attr-defined]
    year = utcnow().year

    async with maker() as s:
        leader = User(tenantId=tid, userid="leader2", username="리더2", role="user")
        s.add(leader)
        await s.flush()
        c1 = Committee(tenantId=tid, name="기획본부", sortOrder=1)
        s.add(c1)
        await s.flush()
        d1 = Department(tenantId=tid, committeeId=c1.id, name="재정팀", sortOrder=1)
        s.add(d1)
        await s.flush()
        s.add(
            UserYearRole(
                tenantId=tid,
                userId=leader.id,
                year=year,
                role="team_leader",
                departmentId=d1.id,
            )
        )
        await s.commit()

    r = await client.get("/api/departments", headers=headers)
    assert r.status_code == 200
    departments = r.json()["departments"]
    assert len(departments) == 1
    dept = departments[0]
    assert dept["committeeName"] == "기획본부"
    assert dept["leaderId"] == leader.id
    assert dept["leaderName"] == "리더2"

    # 다른 연도에는 팀장 매칭이 없어야 한다
    r2 = await client.get(f"/api/departments?year={year + 1}", headers=headers)
    assert r2.json()["departments"][0]["leaderId"] is None


async def test_list_categories_includes_subcategory_count_and_filters_inactive(
    client: AsyncClient,
):
    headers = await _login(client)
    tid = await _tenant_id(client)
    maker = client._maker  # type: ignore[attr-defined]

    async with maker() as s:
        cat_active = BudgetCategory(tenantId=tid, name="사무행정비", sortOrder=1)
        cat_inactive = BudgetCategory(tenantId=tid, name="폐지항목", sortOrder=2, isActive=False)
        s.add_all([cat_active, cat_inactive])
        await s.flush()
        s.add(BudgetSubcategory(tenantId=tid, categoryId=cat_active.id, name="회의비"))
        await s.commit()

    r = await client.get("/api/budget-categories", headers=headers)
    assert r.status_code == 200
    categories = r.json()["categories"]
    assert len(categories) == 1
    assert categories[0]["name"] == "사무행정비"
    assert categories[0]["_count"] == {"subcategories": 1}

    r2 = await client.get("/api/budget-categories?includeInactive=true", headers=headers)
    assert len(r2.json()["categories"]) == 2


async def test_list_subcategories_includes_detail_count_and_excludes_inactive_parent(
    client: AsyncClient,
):
    headers = await _login(client)
    tid = await _tenant_id(client)
    maker = client._maker  # type: ignore[attr-defined]

    async with maker() as s:
        cat = BudgetCategory(tenantId=tid, name="사무행정비", sortOrder=1)
        cat_inactive = BudgetCategory(tenantId=tid, name="폐지항목", sortOrder=2, isActive=False)
        s.add_all([cat, cat_inactive])
        await s.flush()
        sub1 = BudgetSubcategory(tenantId=tid, categoryId=cat.id, name="회의비", sortOrder=1)
        sub_under_inactive_cat = BudgetSubcategory(
            tenantId=tid, categoryId=cat_inactive.id, name="숨김목", sortOrder=1
        )
        s.add_all([sub1, sub_under_inactive_cat])
        await s.commit()

    r = await client.get("/api/budget-subcategories", headers=headers)
    assert r.status_code == 200
    subcategories = r.json()["subcategories"]
    # 비활성 상위 항목 하위의 목은 제외되어야 한다
    assert [s["name"] for s in subcategories] == ["회의비"]
    assert subcategories[0]["_count"] == {"details": 0}

    r2 = await client.get("/api/budget-subcategories?includeInactive=true", headers=headers)
    names = {s["name"] for s in r2.json()["subcategories"]}
    assert names == {"회의비", "숨김목"}
