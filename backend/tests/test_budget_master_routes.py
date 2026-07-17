"""예산 마스터 GET/PATCH/DELETE 라우트 계약 테스트
(C4 — committees/departments/budget-categories/subcategories 조회,
 C5 — 5개 리소스 PATCH 부분수정 + departments DELETE).

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
    BudgetDetail,
    BudgetSubcategory,
    Committee,
    Department,
    DepartmentBudgetDetail,
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


async def _login_as_plain_user(client: AsyncClient, tid: str) -> dict:
    """권한 없는 일반 사용자(role=user)로 로그인 — 403 테스트용."""
    maker = client._maker  # type: ignore[attr-defined]
    async with maker() as s:
        s.add(
            User(
                tenantId=tid,
                userid="member",
                username="일반회원",
                password=hash_password("member123"),
                role="user",
            )
        )
        await s.commit()

    r = await client.post("/api/auth/login", json={"userid": "member", "password": "member123"})
    assert r.status_code == 200
    return {"Authorization": f"Bearer {r.json()['token']}"}


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


# ── C5: PATCH 부분수정 ────────────────────────────────────────────────


async def test_patch_committee_partial_update_and_duplicate_name_conflict(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    maker = client._maker  # type: ignore[attr-defined]

    async with maker() as s:
        c1 = Committee(tenantId=tid, name="기획본부", sortOrder=1)
        c2 = Committee(tenantId=tid, name="사업본부", sortOrder=2)
        s.add_all([c1, c2])
        await s.commit()
        await s.refresh(c1)
        await s.refresh(c2)

    # isActive만 부분 수정 — 다른 필드는 그대로 유지
    r = await client.patch(
        f"/api/committees/{c1.id}", json={"isActive": False}, headers=headers
    )
    assert r.status_code == 200
    body = r.json()
    assert body["isActive"] is False
    assert body["name"] == "기획본부"

    # 중복 이름으로 수정 시도 → 409
    r2 = await client.patch(
        f"/api/committees/{c1.id}", json={"name": "사업본부"}, headers=headers
    )
    assert r2.status_code == 409

    # 존재하지 않는 위원회 → 404
    r3 = await client.patch(
        "/api/committees/no-such-id", json={"name": "x"}, headers=headers
    )
    assert r3.status_code == 404


async def test_patch_committee_requires_permission(client: AsyncClient):
    tid_headers = await _login(client)
    tid = await _tenant_id(client)
    maker = client._maker  # type: ignore[attr-defined]

    async with maker() as s:
        c1 = Committee(tenantId=tid, name="기획본부", sortOrder=1)
        s.add(c1)
        await s.commit()
        await s.refresh(c1)

    member_headers = await _login_as_plain_user(client, tid)
    r = await client.patch(
        f"/api/committees/{c1.id}", json={"name": "변경"}, headers=member_headers
    )
    assert r.status_code == 403
    # admin 토큰은 여전히 정상 동작해야 한다
    assert (await client.get("/api/committees", headers=tid_headers)).status_code == 200


async def test_patch_department_toggle_and_cross_tenant_404(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    maker = client._maker  # type: ignore[attr-defined]

    async with maker() as s:
        c1 = Committee(tenantId=tid, name="기획본부", sortOrder=1)
        s.add(c1)
        await s.flush()
        d1 = Department(tenantId=tid, committeeId=c1.id, name="재정팀", sortOrder=1)
        s.add(d1)
        await s.commit()
        await s.refresh(d1)

        other_tenant = Tenant(name="다른교회", subdomain="other")
        s.add(other_tenant)
        await s.flush()
        c2 = Committee(tenantId=other_tenant.id, name="타테넌트위원회", sortOrder=1)
        s.add(c2)
        await s.flush()
        other_dept = Department(tenantId=other_tenant.id, committeeId=c2.id, name="타테넌트부서", sortOrder=1)
        s.add(other_dept)
        await s.commit()
        await s.refresh(other_dept)
        other_dept_id = other_dept.id

    r = await client.patch(
        f"/api/departments/{d1.id}", json={"isActive": False}, headers=headers
    )
    assert r.status_code == 200
    assert r.json()["isActive"] is False
    assert r.json()["name"] == "재정팀"

    # 다른 테넌트의 부서는 존재해도 404
    r2 = await client.patch(
        f"/api/departments/{other_dept_id}", json={"isActive": False}, headers=headers
    )
    assert r2.status_code == 404


async def test_patch_budget_category_duplicate_name_conflict(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    maker = client._maker  # type: ignore[attr-defined]

    async with maker() as s:
        cat1 = BudgetCategory(tenantId=tid, name="사무행정비", sortOrder=1)
        cat2 = BudgetCategory(tenantId=tid, name="선교비", sortOrder=2)
        s.add_all([cat1, cat2])
        await s.commit()
        await s.refresh(cat1)
        await s.refresh(cat2)

    r = await client.patch(
        f"/api/budget-categories/{cat1.id}", json={"name": "선교비"}, headers=headers
    )
    assert r.status_code == 409

    r2 = await client.patch(
        f"/api/budget-categories/{cat1.id}", json={"sortOrder": 5}, headers=headers
    )
    assert r2.status_code == 200
    assert r2.json()["sortOrder"] == 5
    assert r2.json()["name"] == "사무행정비"


async def test_patch_budget_subcategory_moves_between_categories(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    maker = client._maker  # type: ignore[attr-defined]

    async with maker() as s:
        cat1 = BudgetCategory(tenantId=tid, name="사무행정비", sortOrder=1)
        cat2 = BudgetCategory(tenantId=tid, name="선교비", sortOrder=2)
        s.add_all([cat1, cat2])
        await s.flush()
        sub = BudgetSubcategory(tenantId=tid, categoryId=cat1.id, name="회의비", sortOrder=1)
        s.add(sub)
        await s.commit()
        await s.refresh(sub)

    r = await client.patch(
        f"/api/budget-subcategories/{sub.id}",
        json={"categoryId": cat2.id},
        headers=headers,
    )
    assert r.status_code == 200
    assert r.json()["categoryId"] == cat2.id


async def test_patch_budget_detail_updates_and_clears_optional_fields(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    maker = client._maker  # type: ignore[attr-defined]

    async with maker() as s:
        cat = BudgetCategory(tenantId=tid, name="사무행정비", sortOrder=1)
        s.add(cat)
        await s.flush()
        sub = BudgetSubcategory(tenantId=tid, categoryId=cat.id, name="회의비", sortOrder=1)
        s.add(sub)
        await s.flush()
        detail = BudgetDetail(
            tenantId=tid,
            subcategoryId=sub.id,
            name="다과비",
            accountCode="A1",
            description="설명",
            sortOrder=1,
        )
        s.add(detail)
        await s.commit()
        await s.refresh(detail)

    r = await client.patch(
        f"/api/budget-details/{detail.id}",
        json={"accountCode": "", "description": ""},
        headers=headers,
    )
    assert r.status_code == 200
    body = r.json()
    assert body["accountCode"] is None
    assert body["description"] is None
    assert body["name"] == "다과비"


# ── C5: departments DELETE ───────────────────────────────────────────


async def test_delete_department_blocked_by_referenced_budget_detail(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    maker = client._maker  # type: ignore[attr-defined]

    async with maker() as s:
        c1 = Committee(tenantId=tid, name="기획본부", sortOrder=1)
        s.add(c1)
        await s.flush()
        d1 = Department(tenantId=tid, committeeId=c1.id, name="재정팀", sortOrder=1)
        s.add(d1)
        await s.flush()
        cat = BudgetCategory(tenantId=tid, name="사무행정비", sortOrder=1)
        s.add(cat)
        await s.flush()
        sub = BudgetSubcategory(tenantId=tid, categoryId=cat.id, name="회의비", sortOrder=1)
        s.add(sub)
        await s.flush()
        detail = BudgetDetail(tenantId=tid, subcategoryId=sub.id, name="다과비", sortOrder=1)
        s.add(detail)
        await s.flush()
        s.add(DepartmentBudgetDetail(tenantId=tid, departmentId=d1.id, budgetDetailId=detail.id))
        await s.commit()
        d1_id = d1.id

    r = await client.delete(f"/api/departments/{d1_id}", headers=headers)
    assert r.status_code == 400


async def test_delete_department_blocked_by_year_role(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    maker = client._maker  # type: ignore[attr-defined]

    async with maker() as s:
        c1 = Committee(tenantId=tid, name="기획본부", sortOrder=1)
        s.add(c1)
        await s.flush()
        d1 = Department(tenantId=tid, committeeId=c1.id, name="재정팀", sortOrder=1)
        s.add(d1)
        await s.flush()
        leader = User(tenantId=tid, userid="leader3", username="리더3", role="user")
        s.add(leader)
        await s.flush()
        s.add(
            UserYearRole(
                tenantId=tid,
                userId=leader.id,
                year=utcnow().year,
                role="team_leader",
                departmentId=d1.id,
            )
        )
        await s.commit()
        d1_id = d1.id

    r = await client.delete(f"/api/departments/{d1_id}", headers=headers)
    assert r.status_code == 400


async def test_delete_department_success_without_references(client: AsyncClient):
    headers = await _login(client)
    tid = await _tenant_id(client)
    maker = client._maker  # type: ignore[attr-defined]

    async with maker() as s:
        c1 = Committee(tenantId=tid, name="기획본부", sortOrder=1)
        s.add(c1)
        await s.flush()
        d1 = Department(tenantId=tid, committeeId=c1.id, name="재정팀", sortOrder=1)
        s.add(d1)
        await s.commit()
        d1_id = d1.id

    r = await client.delete(f"/api/departments/{d1_id}", headers=headers)
    assert r.status_code == 200
    assert r.json() == {"success": True}

    r2 = await client.get(f"/api/departments?committeeId={c1.id}", headers=headers)
    assert r2.json()["departments"] == []
