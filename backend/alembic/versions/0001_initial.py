"""initial schema: usuarios, jornadas, clientes, servicios, config

Revision ID: 0001
Revises:
Create Date: 2026-07-31

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "0001"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute('CREATE EXTENSION IF NOT EXISTS "pgcrypto"')

    op.create_table(
        "usuarios",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("nombre", sa.String(120), nullable=False),
        sa.Column("email", sa.String(200), nullable=False),
        sa.Column("password_hash", sa.String(255), nullable=False),
        sa.Column("rol", sa.String(20), nullable=False),
        sa.Column("activo", sa.Boolean, nullable=False, server_default=sa.text("true")),
        sa.Column("creado_en", sa.DateTime, nullable=False, server_default=sa.text("now()")),
        sa.CheckConstraint("rol IN ('admin','tecnico')", name="ck_usuarios_rol"),
        sa.UniqueConstraint("email", name="uq_usuarios_email"),
    )

    op.create_table(
        "clientes",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column("nombre", sa.String(200), nullable=False),
        sa.Column("direccion", sa.Text, nullable=True),
        sa.Column("telefono", sa.String(20), nullable=True),
    )

    op.create_table(
        "jornadas",
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
        sa.Column("entrada_hora", sa.DateTime, nullable=False),
        sa.Column("entrada_lat", sa.Float, nullable=False),
        sa.Column("entrada_lng", sa.Float, nullable=False),
        sa.Column("entrada_precision_m", sa.Float, nullable=False),
        sa.Column("entrada_foto_url", sa.String(300), nullable=False),
        sa.Column("salida_hora", sa.DateTime, nullable=True),
        sa.Column("salida_lat", sa.Float, nullable=True),
        sa.Column("salida_lng", sa.Float, nullable=True),
        sa.Column("salida_precision_m", sa.Float, nullable=True),
        sa.Column("salida_foto_url", sa.String(300), nullable=True),
        sa.Column("horas_trabajadas", sa.Float, nullable=True),
        sa.Column("estatus", sa.String(20), nullable=False, server_default="activa"),
        sa.CheckConstraint(
            "estatus IN ('activa','completa','sin_salida')", name="ck_jornadas_estatus"
        ),
        sa.UniqueConstraint("tecnico_id", "fecha", name="uq_jornadas_tecnico_fecha"),
    )
    op.create_index("ix_jornadas_tecnico_id", "jornadas", ["tecnico_id"])

    op.create_table(
        "servicios",
        sa.Column(
            "id",
            postgresql.UUID(as_uuid=True),
            primary_key=True,
            server_default=sa.text("gen_random_uuid()"),
        ),
        sa.Column(
            "cliente_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("clientes.id"),
            nullable=False,
        ),
        sa.Column(
            "tecnico_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("usuarios.id"),
            nullable=False,
        ),
        sa.Column(
            "asignado_por",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("usuarios.id"),
            nullable=False,
        ),
        sa.Column("fecha", sa.Date, nullable=False),
        sa.Column("descripcion", sa.String(300), nullable=False),
        sa.Column("estatus", sa.String(20), nullable=False, server_default="pendiente"),
        sa.Column("notas", sa.Text, nullable=True),
        sa.CheckConstraint(
            "estatus IN ('pendiente','en_curso','completado','cancelado')",
            name="ck_servicios_estatus",
        ),
    )
    op.create_index("ix_servicios_cliente_id", "servicios", ["cliente_id"])
    op.create_index("ix_servicios_tecnico_id", "servicios", ["tecnico_id"])

    op.create_table(
        "config",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column(
            "company_name", sa.String(120), nullable=False, server_default="field-check"
        ),
        sa.Column("primary_color", sa.String(7), nullable=False, server_default="#1F5FA5"),
        sa.Column("secondary_color", sa.String(7), nullable=False, server_default="#1D9E75"),
        sa.Column("accent_color", sa.String(7), nullable=False, server_default="#F59E0B"),
        sa.Column("logo_url", sa.String(300), nullable=True),
        sa.Column(
            "actualizado_en", sa.DateTime, nullable=False, server_default=sa.text("now()")
        ),
    )

    # Seed the singleton config row with safe defaults.
    op.execute(
        """
        INSERT INTO config (id, company_name, primary_color, secondary_color, accent_color)
        VALUES (1, 'field-check', '#1F5FA5', '#1D9E75', '#F59E0B')
        """
    )


def downgrade() -> None:
    op.drop_table("config")
    op.drop_index("ix_servicios_tecnico_id", table_name="servicios")
    op.drop_index("ix_servicios_cliente_id", table_name="servicios")
    op.drop_table("servicios")
    op.drop_index("ix_jornadas_tecnico_id", table_name="jornadas")
    op.drop_table("jornadas")
    op.drop_table("clientes")
    op.drop_table("usuarios")
