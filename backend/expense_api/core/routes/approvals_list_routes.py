"""결재함 목록/대기건수 라우터.
(app/api/approvals, app/api/approvals/pending-count 이전)
mount prefix: /api/approvals
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import PERMISSIONS
from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.authz import require_permission
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.schemas.approval import ApprovalListOut, PendingCountOut
from expense_api.core.service.approval_service import ApprovalService

router = APIRouter()


@router.get("", response_model=ApprovalListOut)
async def list_approvals(
    status: str = Query("pending"),
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=200),
    user: CurrentUser = Depends(require_permission(PERMISSIONS.EXPENSE_APPROVE)),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> ApprovalListOut:
    svc = ApprovalService(session, tenant_id)
    return await svc.list_for_approver(user.username, status, page, limit)


@router.get("/pending-count", response_model=PendingCountOut)
async def pending_count(
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> PendingCountOut:
    svc = ApprovalService(session, tenant_id)
    count = await svc.count_pending_for_approver(user.username)
    return PendingCountOut(count=count)
