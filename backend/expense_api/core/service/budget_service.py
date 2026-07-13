"""예산 서비스 — 계층 캐스케이드/조회. (app/api/budget/route.ts 로직 이전)

5단계 캐스케이드: 위원회 → 부서 → 항 → 목 → 세목.
항/목/세목은 부서에 연결(DepartmentBudgetDetail)된 세목 기준으로 필터링된다.
"""

from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.repository.budget_repository import BudgetRepository


class BudgetService:
    def __init__(self, session: AsyncSession, tenant_id: str):
        self.repo = BudgetRepository(session, tenant_id)

    async def cascade_options(
        self,
        committee: str | None = None,
        department: str | None = None,
        category: str | None = None,
        subcategory: str | None = None,
    ) -> dict:
        """POST /api/budget — 이미 선택된 값에 따라 다음 레벨 옵션 반환 {field, options}."""
        # 1) 위원회 목록
        if not committee:
            committees = await self.repo.list_committees(active_only=True)
            return {"field": "committees", "options": [c.name for c in committees]}

        # 2) 선택 위원회의 부서 목록
        if not department:
            committee_rec = await self.repo.get_committee_by_name(committee, active_only=True)
            options: list[str] = []
            if committee_rec:
                depts = await self.repo.list_departments(committee_id=committee_rec.id, active_only=True)
                options = [d.name for d in depts]
            return {"field": "departments", "options": options}

        # 3~5) 부서에 연결된 세목 기준 (항/목/세목)
        dept_rec = await self.repo.get_department_by_name(department)
        rows = await self.repo.linked_detail_rows(dept_rec.id) if dept_rec else []

        if not category:
            names = {r.category_name for r in rows if r.category_active}
            return {"field": "categories", "options": sorted(names)}

        if not subcategory:
            names = {
                r.subcategory_name
                for r in rows
                if r.category_name == category and r.subcategory_active
            }
            return {"field": "subcategories", "options": sorted(names)}

        names = {
            r.detail_name
            for r in rows
            if r.subcategory_name == subcategory and r.detail_active and r.detail_name
        }
        return {"field": "details", "options": sorted(names)}

    async def get_hierarchy(
        self,
        committee: str | None = None,
        department: str | None = None,
        category: str | None = None,
        subcategory: str | None = None,
    ) -> dict:
        """GET /api/budget — 계층 데이터 + 위원회-부서 매핑 반환."""
        committees = await self.repo.list_committees(active_only=True)

        committee_id = None
        if committee:
            rec = await self.repo.get_committee_by_name(committee, active_only=True)
            committee_id = rec.id if rec else None
        departments = await self.repo.list_departments(committee_id=committee_id, active_only=True)

        categories: list[str] = []
        subcategories: list[str] = []
        details: list[str] = []

        if department:
            dept_rec = await self.repo.get_department_by_name(department)
            rows = await self.repo.linked_detail_rows(dept_rec.id) if dept_rec else []

            # 카테고리 (삽입 순서 유지 — 원본 Map 동작)
            seen_cat: dict[str, None] = {}
            for r in rows:
                if r.category_active:
                    seen_cat[r.category_name] = None
            categories = list(seen_cat.keys())

            if category:
                seen_sub: dict[str, None] = {}
                for r in rows:
                    if r.category_name == category and r.subcategory_active:
                        seen_sub[r.subcategory_name] = None
                subcategories = list(seen_sub.keys())

                if subcategory:
                    details = [
                        r.detail_name
                        for r in rows
                        if r.subcategory_name == subcategory and r.detail_active
                    ]

        items = [
            {"committee": c, "department": d}
            for c, d in await self.repo.list_departments_with_committee()
        ]

        return {
            "hierarchy": {
                "committees": [c.name for c in committees],
                "departments": [d.name for d in departments],
                "categories": categories,
                "subcategories": subcategories,
                "details": details,
            },
            "items": items,
            "total": len(details),
        }
