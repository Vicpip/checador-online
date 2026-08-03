"""make datetime columns timezone-aware (TIMESTAMPTZ)

Timestamps were previously stored as naive TIMESTAMP columns, which caused
values to silently drift by whatever offset the backend container's local
clock happened to be from the value the caller intended (observed as a ~6h
discrepancy in production). All application code now writes true UTC-aware
datetimes (datetime.now(timezone.utc)); Postgres stores these as TIMESTAMPTZ
internally as UTC and both frontends convert to America/Mexico_City for
display.

Revision ID: 0002
Revises: 0001
Create Date: 2026-08-01

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

# revision identifiers, used by Alembic.
revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # USING clause tells Postgres to interpret the existing naive values as
    # UTC when widening the column, rather than rejecting the cast.
    op.execute(
        "ALTER TABLE usuarios ALTER COLUMN creado_en TYPE timestamptz "
        "USING creado_en AT TIME ZONE 'UTC'"
    )
    op.execute(
        "ALTER TABLE jornadas ALTER COLUMN entrada_hora TYPE timestamptz "
        "USING entrada_hora AT TIME ZONE 'UTC'"
    )
    op.execute(
        "ALTER TABLE jornadas ALTER COLUMN salida_hora TYPE timestamptz "
        "USING salida_hora AT TIME ZONE 'UTC'"
    )
    op.execute(
        "ALTER TABLE config ALTER COLUMN actualizado_en TYPE timestamptz "
        "USING actualizado_en AT TIME ZONE 'UTC'"
    )


def downgrade() -> None:
    op.execute(
        "ALTER TABLE config ALTER COLUMN actualizado_en TYPE timestamp "
        "USING actualizado_en AT TIME ZONE 'UTC'"
    )
    op.execute(
        "ALTER TABLE jornadas ALTER COLUMN salida_hora TYPE timestamp "
        "USING salida_hora AT TIME ZONE 'UTC'"
    )
    op.execute(
        "ALTER TABLE jornadas ALTER COLUMN entrada_hora TYPE timestamp "
        "USING entrada_hora AT TIME ZONE 'UTC'"
    )
    op.execute(
        "ALTER TABLE usuarios ALTER COLUMN creado_en TYPE timestamp "
        "USING creado_en AT TIME ZONE 'UTC'"
    )
