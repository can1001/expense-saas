"""자동이체 서비스. (lib/services/recurring-expense-service.ts 이전, B6)

자동이체 템플릿에서 지출결의서를 생성하고 다음 생성일을 갱신한다.
날짜 비교는 naive UTC datetime 으로 통일한다 (SQLite 라운드트립 시 tzinfo 소실 —
core/service/auth_service.py _as_naive_utc 와 동일한 관례).
"""

from dataclasses import dataclass, field
from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from expense_api.core.domain.recurring_expense import calculate_next_generation_date
from expense_api.core.models.enums import RecurringExpenseStatus
from expense_api.core.models.expense import Expense, ExpenseItem
from expense_api.core.models.recurring_expense import RecurringExpense
from expense_api.core.models.user import User


def _as_naive_utc(value: datetime) -> datetime:
    if value.tzinfo is not None:
        return value.astimezone(timezone.utc).replace(tzinfo=None)
    return value


def _naive_utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _derive_request_team(committee: str, department: str) -> str:
    """청구팀 자동 생성 (lib/domain/request-team.ts deriveRequestTeam 과 동일)."""
    return " ".join(p for p in (committee, department) if p).strip()


def _month_range(now: datetime) -> tuple[datetime, datetime]:
    start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    if now.month == 12:
        next_month_start = datetime(now.year + 1, 1, 1)
    else:
        next_month_start = datetime(now.year, now.month + 1, 1)
    end_of_month = next_month_start - timedelta(microseconds=1)
    return start_of_month, end_of_month


@dataclass
class GenerateResult:
    success: bool
    expense_id: str | None = None
    error: str | None = None


@dataclass
class ProcessResult:
    processed: int
    generated: int
    errors: list[dict] = field(default_factory=list)


async def generate_expense_from_recurring(
    session: AsyncSession, recurring: RecurringExpense
) -> GenerateResult:
    """단일 자동이체 템플릿에서 지출결의서 생성."""
    if recurring.status != RecurringExpenseStatus.ACTIVE.value:
        return GenerateResult(success=False, error="활성화된 자동이체만 생성할 수 있습니다.")

    now = _naive_utcnow()

    if recurring.endDate is not None and _as_naive_utc(recurring.endDate) < now:
        recurring.status = RecurringExpenseStatus.COMPLETED.value
        session.add(recurring)
        await session.commit()
        return GenerateResult(success=False, error="자동이체 종료일이 지났습니다.")

    start_of_month, end_of_month = _month_range(now)
    existing_stmt = select(Expense).where(
        Expense.tenantId == recurring.tenantId,
        Expense.recurringExpenseId == recurring.id,
        Expense.createdAt >= start_of_month,
        Expense.createdAt <= end_of_month,
    )
    existing = (await session.execute(existing_stmt)).scalars().first()
    if existing is not None:
        recurring.nextGenerationDate = calculate_next_generation_date(
            recurring.frequency, recurring.dayOfMonth, recurring.advanceDays
        )
        session.add(recurring)
        await session.commit()
        return GenerateResult(success=False, error="이번 달 이미 생성된 지출결의서가 있습니다.")

    user = await session.get(User, recurring.userId)
    request_team = _derive_request_team(recurring.committee, recurring.department)

    expense = Expense(
        tenantId=recurring.tenantId,
        userId=recurring.userId,
        committee=recurring.committee,
        department=recurring.department,
        applicantName=user.username if user else "",
        accountHolder=recurring.recipientName,
        bankName=recurring.bankName,
        accountNumber=recurring.accountNumber,
        requestAmount=recurring.baseAmount,
        requestDate=now,
        status="DRAFT",
        requestTeam=request_team,
        recurringExpenseId=recurring.id,
    )
    session.add(expense)
    await session.flush()

    session.add(
        ExpenseItem(
            tenantId=recurring.tenantId,
            expenseId=expense.id,
            budgetCategory=recurring.budgetCategory,
            budgetSubcategory=recurring.budgetSubcategory,
            budgetDetail=recurring.budgetDetail or "",
            description=f"{recurring.name} - {now.strftime('%Y년 %m월')}",
            unitPrice=recurring.baseAmount,
            quantity=1,
            amount=recurring.baseAmount,
            order=0,
        )
    )

    recurring.lastGeneratedDate = now
    recurring.nextGenerationDate = calculate_next_generation_date(
        recurring.frequency, recurring.dayOfMonth, recurring.advanceDays
    )
    session.add(recurring)

    await session.commit()
    await session.refresh(expense)

    return GenerateResult(success=True, expense_id=expense.id)


async def process_recurring_expenses(session: AsyncSession) -> ProcessResult:
    """생성이 필요한 모든 자동이체 처리 (크론잡용 — 테넌트 무관 전수 조회, Next 원본과 동일)."""
    now = _naive_utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    stmt = (
        select(RecurringExpense)
        .where(
            RecurringExpense.status == RecurringExpenseStatus.ACTIVE.value,
            RecurringExpense.nextGenerationDate <= now,
        )
        .order_by(RecurringExpense.nextGenerationDate.asc())
    )
    recurring_expenses = list((await session.execute(stmt)).scalars().all())

    result = ProcessResult(processed=len(recurring_expenses), generated=0)

    for recurring in recurring_expenses:
        try:
            gen_result = await generate_expense_from_recurring(session, recurring)
            if gen_result.success:
                result.generated += 1
            else:
                result.errors.append(
                    {
                        "recurringExpenseId": recurring.id,
                        "error": gen_result.error or "알 수 없는 오류",
                    }
                )
        except Exception as e:  # noqa: BLE001 — 개별 실패 격리, Next 원본과 동일하게 다음 건 계속 처리
            await session.rollback()
            result.errors.append({"recurringExpenseId": recurring.id, "error": str(e)})

    return result
