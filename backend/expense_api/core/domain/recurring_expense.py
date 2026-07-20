"""자동이체 다음 생성일 계산 (lib/recurring-expense.ts calculateNextGenerationDate 이전, B6).

날짜 비교는 naive UTC datetime 으로 통일한다 (DB round-trip 시 tzinfo 소실 대비,
core/service/auth_service.py _as_naive_utc 와 동일한 관례).
"""

from datetime import datetime, timedelta, timezone

from expense_api.core.models.enums import RecurringFrequency


def _naive_utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


def _create_generation_date(year: int, month: int, day_of_month: int, advance_days: int) -> datetime:
    transfer_date = datetime(year, month, day_of_month)
    return transfer_date - timedelta(days=advance_days)


def _get_target_months(frequency: str, start_month: int) -> list[int]:
    if frequency == RecurringFrequency.ANNUAL.value:
        return [start_month]
    if frequency == RecurringFrequency.SEMI_ANNUAL.value:
        return [1, 7]
    if frequency == RecurringFrequency.QUARTERLY.value:
        return [1, 4, 7, 10]
    return []


def _find_next_generation_date_in_months(
    months: list[int], year: int, day_of_month: int, advance_days: int, current: datetime
) -> datetime:
    for month in months:
        generation_date = _create_generation_date(year, month, day_of_month, advance_days)
        if generation_date >= current:
            return generation_date
    return _create_generation_date(year + 1, months[0], day_of_month, advance_days)


def calculate_next_generation_date(
    frequency: str,
    day_of_month: int,
    advance_days: int,
    current_date: datetime | None = None,
    start_month: int = 1,
) -> datetime:
    """주어진 주기에 따라 다음 생성일을 계산 (naive UTC datetime 기준)."""
    current = current_date if current_date is not None else _naive_utcnow()
    current = current.replace(hour=0, minute=0, second=0, microsecond=0)
    year = current.year

    if frequency != RecurringFrequency.MONTHLY.value:
        target_months = _get_target_months(frequency, start_month)
        return _find_next_generation_date_in_months(
            target_months, year, day_of_month, advance_days, current
        )

    month = current.month
    generation_date = _create_generation_date(year, month, day_of_month, advance_days)

    if generation_date <= current:
        month += 1
        next_year = year + 1 if month > 12 else year
        next_month = 1 if month > 12 else month
        generation_date = _create_generation_date(next_year, next_month, day_of_month, advance_days)

    return generation_date
