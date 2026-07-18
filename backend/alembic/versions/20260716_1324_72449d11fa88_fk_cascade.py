"""fk cascade — Prisma onDelete: Cascade 대응 FK 에 ondelete=CASCADE 부여.

SQLite 는 무명 FK 를 이름으로 drop 할 수 없으므로, batch_alter_table 에 naming_convention 을
주입해 반영된 FK 에 결정적 이름을 부여한 뒤 재생성한다 (Alembic 표준 레시피).
Postgres 는 batch 가 실제 DROP/ADD CONSTRAINT 로 렌더되며, 무명 FK 는 서버가 자동 부여한
이름(예: "ApprovalLine_expenseId_fkey")을 가지므로 드롭 대상 이름은 리플렉션으로 조회한다.
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "72449d11fa88"
down_revision: Union[str, None] = "e5c41e7fb7e8"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

# 반영된 무명 FK 에 이름 부여용 (column_0_name = FK 첫 컬럼)
NAMING = {"fk": "fk_%(table_name)s_%(column_0_name)s"}

# (table, column, referred_table) — ondelete=CASCADE 대상 (Prisma onDelete: Cascade)
_CASCADES = [
    ("ApprovalLine", "expenseId", "Expense"),
    ("ApprovalStep", "approvalLineId", "ApprovalLine"),
    ("BudgetDetailYear", "budgetDetailId", "BudgetDetail"),
    ("DepartmentBudgetDetail", "departmentId", "Department"),
    ("DepartmentBudgetDetail", "budgetDetailId", "BudgetDetail"),
    ("ExpenseItem", "expenseId", "Expense"),
    ("ExpenseAttachment", "expenseId", "Expense"),
    ("UserYearRole", "userId", "User"),
]


def _reflected_fk_name(table: str, column: str, referred: str) -> str | None:
    insp = sa.inspect(op.get_bind())
    for fk in insp.get_foreign_keys(table):
        if fk["constrained_columns"] == [column] and fk["referred_table"] == referred:
            return fk["name"]
    return None


def _rebuild(table: str, column: str, referred: str, ondelete: str | None) -> None:
    name = f"fk_{table}_{column}"
    # 무명 FK 는 리플렉션 name 이 None(SQLite) → naming_convention 이 부여할 이름으로 폴백
    drop_name = _reflected_fk_name(table, column, referred) or name
    with op.batch_alter_table(table, schema=None, naming_convention=NAMING) as batch_op:
        batch_op.drop_constraint(drop_name, type_="foreignkey")
        batch_op.create_foreign_key(name, referred, [column], ["id"], ondelete=ondelete)


def upgrade() -> None:
    for table, column, referred in _CASCADES:
        _rebuild(table, column, referred, "CASCADE")


def downgrade() -> None:
    for table, column, referred in reversed(_CASCADES):
        _rebuild(table, column, referred, None)
