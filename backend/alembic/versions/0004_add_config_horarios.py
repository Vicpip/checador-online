"""add hora_inicio_jornada / hora_limite_entrada to config

Nullable by design: NULL means "use the HORA_LIMITE_ENTRADA /
HORA_INICIO_JORNADA env var default" (see settings.py / utils/puntualidad.py).

Revision ID: 0004
Revises: 0003
Create Date: 2026-08-01

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0004"
down_revision: Union[str, None] = "0003"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("config", sa.Column("hora_inicio_jornada", sa.Time(), nullable=True))
    op.add_column("config", sa.Column("hora_limite_entrada", sa.Time(), nullable=True))


def downgrade() -> None:
    op.drop_column("config", "hora_limite_entrada")
    op.drop_column("config", "hora_inicio_jornada")
