"""결재 정책 라우터 — 정책 CRUD + 결재선 미리보기. (spec §15.3)"""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import PERMISSIONS
from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.authz import require_permission
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.models.approval_policy import ApprovalPolicy
from expense_api.core.models.budget import (
    BudgetCategory,
    BudgetDetail,
    BudgetDetailYear,
    BudgetSubcategory,
)
from expense_api.core.models.ids import utcnow
from expense_api.core.models.user import User, UserYearRole
from expense_api.core.schemas.approval_policy import (
    ApprovalLinePreviewBudgetOut,
    ApprovalLinePreviewOut,
    ApprovalLinePreviewRequest,
    ApprovalLinePreviewStepOut,
    ApprovalPolicyCreate,
    ApprovalPolicyOut,
)
from expense_api.core.service.approval_policy_engine import (
    ApprovalPolicyEngine,
    ExpenseContext,
    PolicyResolutionError,
)

router = APIRouter()


def _to_out(p: ApprovalPolicy) -> ApprovalPolicyOut:
    return ApprovalPolicyOut(
        id=p.id,
        name=p.name,
        isDefault=p.isDefault,
        isActive=p.isActive,
        collapseDuplicateApprovers=p.collapseDuplicateApprovers,
        steps=p.steps or [],
    )


@router.get("/approval-policies")
async def list_policies(
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    stmt = select(ApprovalPolicy).where(ApprovalPolicy.tenantId == tenant_id)
    rows = (await session.execute(stmt)).scalars().all()
    return {"policies": [_to_out(p).model_dump() for p in rows]}


@router.post(
    "/approval-policies", response_model=ApprovalPolicyOut, status_code=status.HTTP_201_CREATED
)
async def create_policy(
    body: ApprovalPolicyCreate,
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
    _=Depends(require_permission(PERMISSIONS.SETTINGS_MANAGE)),
) -> ApprovalPolicyOut:
    # 기본 정책 지정 시 기존 기본 해제
    if body.isDefault:
        existing = (
            (
                await session.execute(
                    select(ApprovalPolicy).where(
                        ApprovalPolicy.tenantId == tenant_id,
                        ApprovalPolicy.isDefault == True,  # noqa: E712
                    )
                )
            )
            .scalars()
            .all()
        )
        for e in existing:
            e.isDefault = False
    policy = ApprovalPolicy(
        tenantId=tenant_id,
        name=body.name,
        isDefault=body.isDefault,
        collapseDuplicateApprovers=body.collapseDuplicateApprovers,
        steps=[s.model_dump() for s in body.steps],
    )
    session.add(policy)
    await session.commit()
    await session.refresh(policy)
    return _to_out(policy)


async def _load_default_policy(session: AsyncSession, tenant_id: str) -> ApprovalPolicy | None:
    stmt = select(ApprovalPolicy).where(
        ApprovalPolicy.tenantId == tenant_id,
        ApprovalPolicy.isDefault == True,  # noqa: E712
        ApprovalPolicy.isActive == True,  # noqa: E712
    )
    return (await session.execute(stmt)).scalars().first()


async def _year_role_user(
    session: AsyncSession, tenant_id: str, year: int, role: str
) -> User | None:
    stmt = (
        select(User)
        .join(UserYearRole, UserYearRole.userId == User.id)
        .where(
            User.tenantId == tenant_id,
            User.isActive == True,  # noqa: E712
            UserYearRole.year == year,
            UserYearRole.role == role,
        )
    )
    return (await session.execute(stmt)).scalars().first()


@router.post("/approval-line/calculate", response_model=ApprovalLinePreviewOut)
async def calculate_line(
    body: ApprovalLinePreviewRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> ApprovalLinePreviewOut:
    """제출 전 결재선 미리보기 — 예산 항/목/세목 이름 기준으로 정책을 resolve. (레거시 계약)"""
    year = utcnow().year
    if body.requestDate:
        try:
            year = datetime.fromisoformat(body.requestDate).year
        except ValueError:
            pass

    budget_detail_name = body.items[0].budgetDetail
    detail = (
        (
            await session.execute(
                select(BudgetDetail)
                .join(BudgetSubcategory, BudgetSubcategory.id == BudgetDetail.subcategoryId)
                .join(BudgetCategory, BudgetCategory.id == BudgetSubcategory.categoryId)
                .where(
                    BudgetDetail.tenantId == tenant_id,
                    BudgetDetail.name == budget_detail_name,
                    BudgetSubcategory.name == body.budgetSubcategory,
                    BudgetCategory.name == body.budgetCategory,
                )
            )
        )
        .scalars()
        .first()
    )

    policy = await _load_default_policy(session, tenant_id)
    if policy is None:
        raise HTTPException(400, "기본 결재 정책이 없습니다.")

    ctx = ExpenseContext(
        tenant_id=tenant_id,
        year=year,
        applicant_user_id=user.id,
        budget_detail_name=detail.name if detail else None,
    )
    try:
        calc = await ApprovalPolicyEngine(session).resolve(policy, ctx)
    except PolicyResolutionError as e:
        raise HTTPException(400, e.message)

    steps = [
        ApprovalLinePreviewStepOut(
            stepNumber=s.stepNumber,
            stepName=s.stepName,
            approverId=s.approverId,
            approverName=s.approverName,
            isAutoApproved=s.isAutoApproved,
        )
        for s in calc.steps
    ]

    if detail is None:
        return ApprovalLinePreviewOut(
            totalSteps=calc.totalSteps,
            steps=steps,
            year=year,
        )

    detail_year = (
        (
            await session.execute(
                select(BudgetDetailYear).where(
                    BudgetDetailYear.budgetDetailId == detail.id,
                    BudgetDetailYear.year == year,
                )
            )
        )
        .scalars()
        .first()
    )
    manager = (
        await session.get(User, detail_year.managerId)
        if detail_year and detail_year.managerId
        else None
    )
    finance_head = await _year_role_user(session, tenant_id, year, "finance_head")
    is_direct_approval = bool(manager and finance_head and manager.id == finance_head.id)

    budget_amount = detail_year.budgetAmount if detail_year else 0
    used_amount = detail_year.usedAmount if detail_year else 0

    return ApprovalLinePreviewOut(
        budgetDetailId=detail.id,
        budgetDetailName=detail.name,
        managerId=manager.id if manager else None,
        managerName=manager.username if manager else None,
        isDirectApproval=is_direct_approval,
        totalSteps=calc.totalSteps,
        steps=steps,
        year=year,
        budget=ApprovalLinePreviewBudgetOut(
            budgetAmount=budget_amount,
            usedAmount=used_amount,
            remainingAmount=budget_amount - used_amount,
            isOverBudget=used_amount > budget_amount,
        ),
    )
