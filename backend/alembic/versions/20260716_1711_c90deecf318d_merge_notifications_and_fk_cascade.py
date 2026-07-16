"""merge notifications and fk_cascade

Revision ID: c90deecf318d
Revises: e9ad8599b0ac, 72449d11fa88
Create Date: 2026-07-16 17:11:06.073293
"""
from typing import Sequence, Union

# revision identifiers, used by Alembic.
revision: str = 'c90deecf318d'
down_revision: Union[str, None] = ('e9ad8599b0ac', '72449d11fa88')
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
