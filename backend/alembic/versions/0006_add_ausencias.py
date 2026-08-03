"""add ausencias table (técnico absences / time-off)

`tipo` follows a fixed set of Spanish labels used throughout the reportes
analysis: 'falta' | 'vacaciones' | 'permiso_con_goce' | 'permiso_sin_goce' |
'incapacidad'. UNIQUE(tecnico_id, fecha) mirrors `jornadas` — a técnico can't
have two absence records on the same day, and the admin router additionally
rejects creating one on a day that already has a `jornada` (409).

Revision ID: 0006
Revises: 0005
Create Date: 2026-08-03

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0006"
down_revision: Union[str, None] = "0005"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "ausencias",
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
        sa.Column("fecha", sa.Date, nullable=False),
        sa.Column("tipo", sa.String(30), nullable=False),
        sa.Column("notas", sa.Text, nullable=True),
        sa.Column(
            "creado_por",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("usuarios.id"),
            nullable=False,
        ),
        sa.Column(
            "creado_en",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "tipo IN ('falta','vacaciones','permiso_con_goce','permiso_sin_goce','incapacidad')",
            name="ck_ausencias_tipo",
        ),
        sa.UniqueConstraint("tecnico_id", "fecha", name="uq_ausencias_tecnico_fecha"),
    )
    op.create_index("ix_ausencias_tecnico_id", "ausencias", ["tecnico_id"])


def downgrade() -> None:
    op.drop_index("ix_ausencias_tecnico_id", table_name="ausencias")
    op.drop_table("ausencias")
