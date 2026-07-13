"""결재 정책 라우터 — 정책 CRUD + 결재선 미리보기. (spec §15.3)"""

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import PERMISSIONS
from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.authz import require_permission
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.models.approval_policy import ApprovalPolicy
from expense_api.core.models.expense import Expense
from expense_api.core.schemas.approval_policy import (
    ApprovalPolicyCreate,
    ApprovalPolicyOut,
    CalculatedLineOut,
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


class CalculateRequest(BaseModel):
    expenseId: str
    policyId: str | None = None


@router.post("/approval-line/calculate", response_model=CalculatedLineOut)
async def calculate_line(
    body: CalculateRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> CalculatedLineOut:
    """제출 전 결재선 미리보기 — 정책을 지출 컨텍스트로 resolve."""
    expense = (
        (
            await session.execute(
                select(Expense).where(Expense.tenantId == tenant_id, Expense.id == body.expenseId)
            )
        )
        .scalars()
        .first()
    )
    if expense is None:
        raise HTTPException(404, "지출결의서를 찾을 수 없습니다.")

    # 정책 로드
    if body.policyId:
        policy = await session.get(ApprovalPolicy, body.policyId)
        if policy is None or policy.tenantId != tenant_id:
            raise HTTPException(404, "결재 정책을 찾을 수 없습니다.")
    else:
        policy = (
            (
                await session.execute(
                    select(ApprovalPolicy).where(
                        ApprovalPolicy.tenantId == tenant_id,
                        ApprovalPolicy.isDefault == True,  # noqa: E712
                        ApprovalPolicy.isActive == True,  # noqa: E712
                    )
                )
            )
            .scalars()
            .first()
        )
        if policy is None:
            raise HTTPException(400, "기본 결재 정책이 없습니다.")

    # 첫 항목 세목명
    from expense_api.core.models.expense import ExpenseItem

    detail_name = (
        (
            await session.execute(
                select(ExpenseItem.budgetDetail)
                .where(ExpenseItem.expenseId == expense.id)
                .order_by(ExpenseItem.order)
                .limit(1)
            )
        )
        .scalars()
        .first()
    )

    ctx = ExpenseContext(
        tenant_id=tenant_id,
        year=expense.requestDate.year,
        applicant_user_id=expense.userId,
        budget_detail_name=detail_name,
    )
    try:
        return await ApprovalPolicyEngine(session).resolve(policy, ctx)
    except PolicyResolutionError as e:
        raise HTTPException(400, e.message)
