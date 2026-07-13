"""Phase 2 검증 — 예산 계층 캐스케이드, 부서-세목 링크 필터, 테넌트 격리."""

import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.pool import StaticPool
from sqlmodel import SQLModel

import expense_api.core.models  # noqa: F401
from expense_api.core.models.budget import (
    BudgetCategory,
    BudgetDetail,
    BudgetSubcategory,
    Committee,
    Department,
    DepartmentBudgetDetail,
)
from expense_api.core.models.tenant import Tenant
from expense_api.core.service.budget_service import BudgetService


@pytest_asyncio.fixture
async def session() -> AsyncSession:
    engine = create_async_engine(
        "sqlite+aiosqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)
    maker = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with maker() as s:
        yield s
    await engine.dispose()


async def _build_tree(session: AsyncSession, tid: str, committee_name: str = "기획본부") -> None:
    """테넌트 tid 에 예산 트리 생성.
    committee_name → 재정팀 → (사무행정비/회의비/[간식비,다과비], 인건비/급여/[정규직급여])
    영업팀 → 인건비/급여/[정규직급여] 만 링크.
    """
    c1 = Committee(tenantId=tid, name=committee_name, sortOrder=1)
    c2 = Committee(tenantId=tid, name="사업본부", sortOrder=2)
    session.add_all([c1, c2])
    await session.flush()
    d_fin = Department(tenantId=tid, committeeId=c1.id, name="재정팀", sortOrder=1)
    d_sales = Department(tenantId=tid, committeeId=c2.id, name="영업팀", sortOrder=2)
    session.add_all([d_fin, d_sales])
    cat_admin = BudgetCategory(tenantId=tid, name="사무행정비", sortOrder=1)
    cat_hr = BudgetCategory(tenantId=tid, name="인건비", sortOrder=2)
    session.add_all([cat_admin, cat_hr])
    await session.flush()
    sub_meeting = BudgetSubcategory(tenantId=tid, categoryId=cat_admin.id, name="회의비")
    sub_salary = BudgetSubcategory(tenantId=tid, categoryId=cat_hr.id, name="급여")
    session.add_all([sub_meeting, sub_salary])
    await session.flush()
    det_snack = BudgetDetail(tenantId=tid, subcategoryId=sub_meeting.id, name="간식비")
    det_tea = BudgetDetail(tenantId=tid, subcategoryId=sub_meeting.id, name="다과비")
    det_reg = BudgetDetail(tenantId=tid, subcategoryId=sub_salary.id, name="정규직급여")
    session.add_all([det_snack, det_tea, det_reg])
    await session.flush()
    for det in (det_snack, det_tea, det_reg):
        session.add(DepartmentBudgetDetail(tenantId=tid, departmentId=d_fin.id, budgetDetailId=det.id))
    session.add(DepartmentBudgetDetail(tenantId=tid, departmentId=d_sales.id, budgetDetailId=det_reg.id))
    await session.flush()


async def test_cascade_levels(session: AsyncSession):
    t = Tenant(name="T", subdomain="t")
    session.add(t)
    await session.flush()
    await _build_tree(session, t.id)
    svc = BudgetService(session, t.id)

    # 1) 위원회
    r = await svc.cascade_options()
    assert r == {"field": "committees", "options": ["기획본부", "사업본부"]}
    # 2) 부서
    r = await svc.cascade_options(committee="기획본부")
    assert r == {"field": "departments", "options": ["재정팀"]}
    # 3) 항 (부서 링크 기준)
    r = await svc.cascade_options(committee="기획본부", department="재정팀")
    assert r == {"field": "categories", "options": ["사무행정비", "인건비"]}
    # 4) 목
    r = await svc.cascade_options(committee="기획본부", department="재정팀", category="사무행정비")
    assert r == {"field": "subcategories", "options": ["회의비"]}
    # 5) 세목
    r = await svc.cascade_options(
        committee="기획본부", department="재정팀", category="사무행정비", subcategory="회의비"
    )
    assert r == {"field": "details", "options": ["간식비", "다과비"]}


async def test_link_filter_excludes_unlinked_category(session: AsyncSession):
    t = Tenant(name="T", subdomain="t")
    session.add(t)
    await session.flush()
    await _build_tree(session, t.id)
    svc = BudgetService(session, t.id)

    # 영업팀은 정규직급여(인건비)만 링크 → 사무행정비는 보이면 안 됨
    r = await svc.cascade_options(committee="사업본부", department="영업팀")
    assert r["options"] == ["인건비"]
    assert "사무행정비" not in r["options"]


async def test_hierarchy_shape(session: AsyncSession):
    t = Tenant(name="T", subdomain="t")
    session.add(t)
    await session.flush()
    await _build_tree(session, t.id)
    svc = BudgetService(session, t.id)

    h = await svc.get_hierarchy(department="재정팀")
    assert h["hierarchy"]["committees"] == ["기획본부", "사업본부"]
    assert set(h["hierarchy"]["categories"]) == {"사무행정비", "인건비"}
    assert len(h["items"]) == 2  # 위원회-부서 매핑 2건


async def test_tenant_isolation(session: AsyncSession):
    ta = Tenant(name="A", subdomain="a")
    tb = Tenant(name="B", subdomain="b")
    session.add_all([ta, tb])
    await session.flush()
    await _build_tree(session, ta.id, committee_name="A본부")
    await _build_tree(session, tb.id, committee_name="B본부")

    svc_a = BudgetService(session, ta.id)
    r = await svc_a.cascade_options()
    # A 테넌트는 자기 위원회만 (B본부 안 보임)
    assert "A본부" in r["options"]
    assert "B본부" not in r["options"]
