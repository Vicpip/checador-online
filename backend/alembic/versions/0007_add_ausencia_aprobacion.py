"""add estatus/respuesta_notas/respondida_por to ausencias (approval workflow)

Técnico self-requests (`POST /jornadas/ausencias`) now start as `estatus=
'pendiente'` until an admin approves/rejects them via
`PATCH /admin/ausencias/{id}/responder`. Admin-created ausencias (`POST
/admin/ausencias`) keep going straight to `'aprobada'` — they don't need
review. The column `server_default='aprobada'` backfills every pre-existing
row, since all of them were admin-created before this migration existed.

Revision ID: 0007
Revises: 0006
Create Date: 2026-08-03

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0007"
down_revision: Union[str, None] = "0006"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ausencias",
        sa.Column("estatus", sa.String(20), nullable=False, server_default="aprobada"),
    )
    op.add_column("ausencias", sa.Column("respuesta_notas", sa.Text(), nullable=True))
    op.add_column(
        "ausencias",
        sa.Column(
            "respondida_por",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("usuarios.id"),
            nullable=True,
        ),
    )
    op.create_check_constraint(
        "ck_ausencias_estatus",
        "ausencias",
        "estatus IN ('pendiente','aprobada','rechazada')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_ausencias_estatus", "ausencias", type_="check")
    op.drop_column("ausencias", "respondida_por")
    op.drop_column("ausencias", "respuesta_notas")
    op.drop_column("ausencias", "estatus")
