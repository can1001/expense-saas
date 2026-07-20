"""자동이체(정기 지출결의서)·시스템 설정 라우터. (app/api/recurring-expenses*, app/api/settings 이전, B6)

recurring-expenses/process 는 크론잡 전용 — 사용자 인증 없이 Authorization: Bearer
<CRON_SECRET> 헤더로 인증한다 (app/api/recurring-expenses/process/route.ts 와 동일 계약).
"""

import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from sqlalchemy import and_, nullslast, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.auth.permissions import PERMISSIONS
from expense_api.core.config.settings import settings
from expense_api.core.db.session import get_session
from expense_api.core.dependencies.auth import CurrentUser, get_current_user
from expense_api.core.dependencies.authz import effective_permissions, require_permission
from expense_api.core.dependencies.tenant import require_tenant_id
from expense_api.core.domain.recurring_expense import calculate_next_generation_date
from expense_api.core.models.expense import Expense
from expense_api.core.models.recurring_expense import RecurringExpense
from expense_api.core.models.system_setting import SystemSetting
from expense_api.core.models.user import User
from expense_api.core.schemas.recurring_expense import (
    CreateRecurringExpenseRequest,
    GenerateRecurringExpenseOut,
    RecurringExpenseDetailOut,
    RecurringExpenseGeneratedExpenseOut,
    RecurringExpenseListOut,
    RecurringExpenseOut,
    RecurringExpenseUserOut,
    RecurringExpenseWithUserOut,
    UpdateRecurringExpenseRequest,
)
from expense_api.core.schemas.settings import (
    UpdateSettingOut,
    UpdateSettingRequest,
    UpdateSettingResponse,
)
from expense_api.core.service.recurring_expense_service import (
    generate_expense_from_recurring,
    process_recurring_expenses,
)

router = APIRouter()
process_router = APIRouter()
settings_router = APIRouter()


def _as_naive_utc(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


async def _check_recurring_access(user: CurrentUser, session: AsyncSession) -> set[str]:
    perms = await effective_permissions(user, session)
    if PERMISSIONS.RECURRING_READ not in perms:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "자동이체 접근 권한이 없습니다.")
    return perms


async def _get_recurring(
    session: AsyncSession, tenant_id: str, recurring_id: str
) -> RecurringExpense | None:
    stmt = select(RecurringExpense).where(
        RecurringExpense.tenantId == tenant_id, RecurringExpense.id == recurring_id
    )
    return (await session.execute(stmt)).scalars().first()


def _to_out(r: RecurringExpense) -> RecurringExpenseOut:
    return RecurringExpenseOut(
        id=r.id,
        tenantId=r.tenantId,
        userId=r.userId,
        name=r.name,
        description=r.description,
        committee=r.committee,
        department=r.department,
        budgetCategory=r.budgetCategory,
        budgetSubcategory=r.budgetSubcategory,
        budgetDetail=r.budgetDetail,
        recipientName=r.recipientName,
        bankName=r.bankName,
        accountNumber=r.accountNumber,
        baseAmount=r.baseAmount,
        frequency=r.frequency,
        dayOfMonth=r.dayOfMonth,
        startDate=r.startDate,
        endDate=r.endDate,
        advanceDays=r.advanceDays,
        status=r.status,
        lastGeneratedDate=r.lastGeneratedDate,
        nextGenerationDate=r.nextGenerationDate,
        deletedAt=r.deletedAt,
        createdAt=r.createdAt,
        updatedAt=r.updatedAt,
    )


@router.get("", response_model=RecurringExpenseListOut)
async def list_recurring_expenses(
    cursor: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1),
    status_filter: str | None = Query(default=None, alias="status"),
    search: str | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> RecurringExpenseListOut:
    perms = await _check_recurring_access(user, session)
    manage_all = PERMISSIONS.RECURRING_MANAGE_ALL in perms

    stmt = select(RecurringExpense).where(RecurringExpense.tenantId == tenant_id)
    if not manage_all:
        stmt = stmt.where(RecurringExpense.userId == user.id)

    if status_filter == "CANCELLED":
        stmt = stmt.where(RecurringExpense.status == "CANCELLED")
    elif status_filter:
        stmt = stmt.where(RecurringExpense.status == status_filter)
    else:
        stmt = stmt.where(RecurringExpense.status != "CANCELLED")

    if search:
        term = f"%{search.strip()}%"
        stmt = stmt.where(
            or_(RecurringExpense.name.ilike(term), RecurringExpense.recipientName.ilike(term))
        )

    if cursor:
        cursor_stmt = select(RecurringExpense).where(
            RecurringExpense.tenantId == tenant_id, RecurringExpense.id == cursor
        )
        cursor_row = (await session.execute(cursor_stmt)).scalars().first()
        if cursor_row is not None:
            if cursor_row.nextGenerationDate is not None:
                stmt = stmt.where(
                    or_(
                        RecurringExpense.nextGenerationDate > cursor_row.nextGenerationDate,
                        and_(
                            RecurringExpense.nextGenerationDate == cursor_row.nextGenerationDate,
                            RecurringExpense.id > cursor_row.id,
                        ),
                        RecurringExpense.nextGenerationDate.is_(None),
                    )
                )
            else:
                stmt = stmt.where(
                    RecurringExpense.nextGenerationDate.is_(None),
                    RecurringExpense.id > cursor_row.id,
                )

    stmt = stmt.order_by(
        nullslast(RecurringExpense.nextGenerationDate.asc()), RecurringExpense.id.asc()
    ).limit(limit + 1)

    rows = list((await session.execute(stmt)).scalars().all())
    has_more = len(rows) > limit
    data = rows[:limit] if has_more else rows
    next_cursor = data[-1].id if has_more and data else None

    user_ids = {r.userId for r in data}
    users_map: dict[str, User] = {}
    if user_ids:
        users_stmt = select(User).where(User.id.in_(user_ids))
        users_map = {u.id: u for u in (await session.execute(users_stmt)).scalars().all()}

    items = [
        RecurringExpenseWithUserOut(
            **_to_out(r).model_dump(),
            user=RecurringExpenseUserOut(
                id=r.userId, username=users_map[r.userId].username if r.userId in users_map else ""
            ),
        )
        for r in data
    ]

    return RecurringExpenseListOut(recurringExpenses=items, nextCursor=next_cursor, hasMore=has_more)


@router.post("", response_model=RecurringExpenseOut, status_code=status.HTTP_201_CREATED)
async def create_recurring_expense(
    body: CreateRecurringExpenseRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> RecurringExpenseOut:
    await _check_recurring_access(user, session)

    start_date = _as_naive_utc(body.startDate)
    end_date = _as_naive_utc(body.endDate) if body.endDate else None

    next_generation_date = calculate_next_generation_date(
        body.frequency, body.dayOfMonth, body.advanceDays, start_date
    )

    recurring = RecurringExpense(
        tenantId=tenant_id,
        userId=user.id,
        name=body.name,
        description=body.description,
        committee=body.committee,
        department=body.department,
        budgetCategory=body.budgetCategory,
        budgetSubcategory=body.budgetSubcategory,
        budgetDetail=body.budgetDetail,
        recipientName=body.recipientName,
        bankName=body.bankName,
        accountNumber=body.accountNumber,
        baseAmount=body.baseAmount,
        frequency=body.frequency,
        dayOfMonth=body.dayOfMonth,
        startDate=start_date,
        endDate=end_date,
        advanceDays=body.advanceDays,
        nextGenerationDate=next_generation_date,
        status="ACTIVE",
    )
    session.add(recurring)
    await session.commit()
    await session.refresh(recurring)
    return _to_out(recurring)


@router.get("/{recurring_id}", response_model=RecurringExpenseDetailOut)
async def get_recurring_expense(
    recurring_id: str,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> RecurringExpenseDetailOut:
    perms = await _check_recurring_access(user, session)
    manage_all = PERMISSIONS.RECURRING_MANAGE_ALL in perms

    recurring = await _get_recurring(session, tenant_id, recurring_id)
    if recurring is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "자동이체를 찾을 수 없습니다.")
    if not manage_all and recurring.userId != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "조회 권한이 없습니다.")

    owner = await session.get(User, recurring.userId)

    generated_stmt = (
        select(Expense)
        .where(Expense.tenantId == tenant_id, Expense.recurringExpenseId == recurring_id)
        .order_by(Expense.createdAt.desc())
    )
    generated = list((await session.execute(generated_stmt)).scalars().all())

    return RecurringExpenseDetailOut(
        **_to_out(recurring).model_dump(),
        user=RecurringExpenseUserOut(
            id=recurring.userId, username=owner.username if owner else ""
        ),
        generatedExpenses=[
            RecurringExpenseGeneratedExpenseOut(
                id=e.id,
                requestAmount=e.requestAmount,
                status=e.status,
                createdAt=e.createdAt,
                accountHolder=e.accountHolder,
            )
            for e in generated
        ],
    )


@router.put("/{recurring_id}", response_model=RecurringExpenseOut)
async def update_recurring_expense(
    recurring_id: str,
    body: UpdateRecurringExpenseRequest,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> RecurringExpenseOut:
    perms = await _check_recurring_access(user, session)
    manage_all = PERMISSIONS.RECURRING_MANAGE_ALL in perms

    recurring = await _get_recurring(session, tenant_id, recurring_id)
    if recurring is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "자동이체를 찾을 수 없습니다.")
    if not manage_all and recurring.userId != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "수정 권한이 없습니다.")

    if recurring.status in ("CANCELLED", "COMPLETED"):
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, "취소되거나 완료된 자동이체는 수정할 수 없습니다."
        )

    data = body.model_dump(exclude_unset=True)
    recalc = "dayOfMonth" in data or "advanceDays" in data
    new_day_of_month = data.get("dayOfMonth", recurring.dayOfMonth)
    new_advance_days = data.get("advanceDays", recurring.advanceDays)

    if "name" in data:
        recurring.name = data["name"]
    if "description" in data:
        recurring.description = data["description"]
    if "recipientName" in data:
        recurring.recipientName = data["recipientName"]
    if "bankName" in data:
        recurring.bankName = data["bankName"]
    if "accountNumber" in data:
        recurring.accountNumber = data["accountNumber"]
    if "baseAmount" in data:
        recurring.baseAmount = data["baseAmount"]
    if "dayOfMonth" in data:
        recurring.dayOfMonth = data["dayOfMonth"]
    if "advanceDays" in data:
        recurring.advanceDays = data["advanceDays"]
    if "endDate" in data:
        recurring.endDate = _as_naive_utc(data["endDate"]) if data["endDate"] else None
    if "status" in data:
        recurring.status = data["status"]

    if recalc:
        recurring.nextGenerationDate = calculate_next_generation_date(
            recurring.frequency, new_day_of_month, new_advance_days
        )

    session.add(recurring)
    await session.commit()
    await session.refresh(recurring)
    return _to_out(recurring)


@router.delete("/{recurring_id}")
async def delete_recurring_expense(
    recurring_id: str,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    perms = await _check_recurring_access(user, session)
    manage_all = PERMISSIONS.RECURRING_MANAGE_ALL in perms

    recurring = await _get_recurring(session, tenant_id, recurring_id)
    if recurring is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "자동이체를 찾을 수 없습니다.")
    if not manage_all and recurring.userId != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "삭제 권한이 없습니다.")
    if recurring.status == "CANCELLED":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "이미 취소된 자동이체입니다.")

    recurring.status = "CANCELLED"
    recurring.deletedAt = datetime.now(timezone.utc).replace(tzinfo=None)
    session.add(recurring)
    await session.commit()
    return {"message": "자동이체가 취소되었습니다."}


@router.post(
    "/{recurring_id}/generate",
    response_model=GenerateRecurringExpenseOut,
    status_code=status.HTTP_201_CREATED,
)
async def generate_recurring_expense(
    recurring_id: str,
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> GenerateRecurringExpenseOut:
    perms = await _check_recurring_access(user, session)
    manage_all = PERMISSIONS.RECURRING_MANAGE_ALL in perms

    recurring = await _get_recurring(session, tenant_id, recurring_id)
    if recurring is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "자동이체를 찾을 수 없습니다.")
    if not manage_all and recurring.userId != user.id:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "생성 권한이 없습니다.")

    result = await generate_expense_from_recurring(session, recurring)
    if not result.success:
        raise HTTPException(
            status.HTTP_400_BAD_REQUEST, result.error or "지출결의서 생성에 실패했습니다."
        )

    return GenerateRecurringExpenseOut(expenseId=result.expense_id)


@process_router.post("")
async def process_recurring(
    request: Request,
    session: AsyncSession = Depends(get_session),
) -> dict:
    auth_header = request.headers.get("authorization")
    cron_secret = settings.CRON_SECRET

    if not cron_secret:
        if settings.is_prod:
            raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "서버 설정 오류입니다.")
    elif auth_header != f"Bearer {cron_secret}":
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "인증에 실패했습니다.")

    result = await process_recurring_expenses(session)

    return {
        "success": True,
        "message": f"{result.generated}건의 지출결의서가 생성되었습니다.",
        "result": {
            "processed": result.processed,
            "generated": result.generated,
            "errors": result.errors,
        },
    }


def _parse_setting_value(raw: str):
    try:
        return json.loads(raw)
    except (json.JSONDecodeError, TypeError):
        return raw


@settings_router.get("")
async def get_settings(
    key: str | None = Query(default=None),
    keys: str | None = Query(default=None),
    user: CurrentUser = Depends(get_current_user),
    tenant_id: str = Depends(require_tenant_id),
    session: AsyncSession = Depends(get_session),
) -> dict:
    if key:
        stmt = select(SystemSetting).where(
            SystemSetting.tenantId == tenant_id, SystemSetting.key == key
        )
        setting = (await session.execute(stmt)).scalars().first()
        if setting is None:
            return {"key": key, "value": None}
        return {
            "key": setting.key,
            "value": _parse_setting_value(setting.value),
            "description": setting.description,
        }

    if keys:
        key_list = [k.strip() for k in keys.split(",")]
        stmt = select(SystemSetting).where(
            SystemSetting.tenantId == tenant_id, SystemSetting.key.in_(key_list)
        )
        rows = list((await session.execute(stmt)).scalars().all())
        result: dict = {r.key: _parse_setting_value(r.value) for r in rows}
        for k in key_list:
            if k not in result:
                result[k] = None
        return result

    stmt = (
        select(SystemSetting)
        .where(SystemSetting.tenantId == tenant_id)
        .order_by(SystemSetting.key.asc())
    )
    rows = list((await session.execute(stmt)).scalars().all())
    return {
        r.key: {"value": _parse_setting_value(r.value), "description": r.description} for r in rows
    }


@settings_router.put("", response_model=UpdateSettingResponse)
async def update_setting(
    body: UpdateSettingRequest,
    tenant_id: str = Depends(require_tenant_id),
    _=Depends(require_permission(PERMISSIONS.SETTINGS_MANAGE)),
    session: AsyncSession = Depends(get_session),
) -> UpdateSettingResponse:
    if not body.key:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "설정 키가 필요합니다.")

    string_value = body.value if isinstance(body.value, str) else json.dumps(
        body.value, ensure_ascii=False
    )

    stmt = select(SystemSetting).where(
        SystemSetting.tenantId == tenant_id, SystemSetting.key == body.key
    )
    existing = (await session.execute(stmt)).scalars().first()

    if existing is not None:
        existing.value = string_value
        if body.description:
            existing.description = body.description
        session.add(existing)
        setting = existing
    else:
        setting = SystemSetting(
            tenantId=tenant_id,
            key=body.key,
            value=string_value,
            description=body.description or None,
        )
        session.add(setting)

    await session.commit()
    await session.refresh(setting)

    return UpdateSettingResponse(
        success=True,
        setting=UpdateSettingOut(
            key=setting.key,
            value=_parse_setting_value(setting.value),
            description=setting.description,
        ),
    )
