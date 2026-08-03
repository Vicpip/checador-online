"""add horarios table (per-técnico expected weekly schedule)

`dia_semana` follows Python's `date.weekday()` convention (0=Lunes ...
6=Domingo) so the reportes endpoint can look a row up with `fecha.weekday()`
directly, no remapping needed.

Revision ID: 0005
Revises: 0004
Create Date: 2026-08-01

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0005"
down_revision: Union[str, None] = "0004"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "horarios",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "tecnico_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("usuarios.id"),
            nullable=False,
        ),
        sa.Column("dia_semana", sa.SmallInteger, nullable=False),
        sa.Column("hora_inicio", sa.Time, nullable=False),
        sa.Column("hora_fin", sa.Time, nullable=False),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.CheckConstraint("dia_semana >= 0 AND dia_semana <= 6", name="ck_horarios_dia_semana"),
        sa.UniqueConstraint("tecnico_id", "dia_semana", name="uq_horarios_tecnico_dia"),
    )
    op.create_index("ix_horarios_tecnico_id", "horarios", ["tecnico_id"])


def downgrade() -> None:
    op.drop_index("ix_horarios_tecnico_id", table_name="horarios")
    op.drop_table("horarios")
