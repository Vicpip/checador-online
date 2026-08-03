"""
SQLAlchemy 2.x models.

IMPORTANT: `jornadas` and `servicios` are intentionally decoupled — no FK
between them. Attendance (jornadas) and scheduling (servicios) are separate
concerns and must stay that way (see CONTEXT_CHECADOR.md).
"""
import uuid
from datetime import date, datetime, time

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    Float,
    ForeignKey,
    SmallInteger,
    String,
    Text,
    Time,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from database import Base


class Usuario(Base):
    __tablename__ = "usuarios"
    __table_args__ = (CheckConstraint("rol IN ('admin','tecnico')", name="ck_usuarios_rol"),)

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String(120), nullable=False)
    email: Mapped[str] = mapped_column(String(200), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    rol: Mapped[str] = mapped_column(String(20), nullable=False)
    activo: Mapped[bool] = mapped_column(default=True, nullable=False)
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


class Horario(Base):
    """
    Expected weekly schedule for a técnico. One row per (tecnico, dia_semana);
    `dia_semana` follows Python's `date.weekday()` convention (0=Lunes ...
    6=Domingo) so `fecha.weekday()` can look a row up directly with no
    remapping — see utils/puntualidad.py.
    """

    __tablename__ = "horarios"
    __table_args__ = (
        UniqueConstraint("tecnico_id", "dia_semana", name="uq_horarios_tecnico_dia"),
        CheckConstraint("dia_semana >= 0 AND dia_semana <= 6", name="ck_horarios_dia_semana"),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tecnico_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False, index=True
    )
    dia_semana: Mapped[int] = mapped_column(SmallInteger, nullable=False)
    hora_inicio: Mapped[time] = mapped_column(Time, nullable=False)
    hora_fin: Mapped[time] = mapped_column(Time, nullable=False)
    activo: Mapped[bool] = mapped_column(default=True, nullable=False)

    tecnico: Mapped["Usuario"] = relationship(foreign_keys=[tecnico_id])


class Ausencia(Base):
    """
    Recorded time-off / absence for a técnico on a given date. Kept separate
    from `jornadas` (no FK, same decoupling rationale as jornadas/servicios) —
    a técnico has *either* a jornada *or* an ausencia on a given day, never
    both; the admin router enforces this at creation time (409 if a jornada
    already exists for that tecnico_id/fecha). See utils/puntualidad.py and
    routers/admin.py::reporte_tecnico for how the reportes endpoint uses this
    to distinguish justified absences from `falta_injustificada`.
    """

    __tablename__ = "ausencias"
    __table_args__ = (
        UniqueConstraint("tecnico_id", "fecha", name="uq_ausencias_tecnico_fecha"),
        CheckConstraint(
            "tipo IN ('falta','vacaciones','permiso_con_goce','permiso_sin_goce','incapacidad')",
            name="ck_ausencias_tipo",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tecnico_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False, index=True
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    tipo: Mapped[str] = mapped_column(String(30), nullable=False)
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)
    creado_por: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False
    )
    creado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    tecnico: Mapped["Usuario"] = relationship(foreign_keys=[tecnico_id])


class Jornada(Base):
    __tablename__ = "jornadas"
    __table_args__ = (
        UniqueConstraint("tecnico_id", "fecha", name="uq_jornadas_tecnico_fecha"),
        CheckConstraint(
            "estatus IN ('activa','completa','sin_salida')", name="ck_jornadas_estatus"
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tecnico_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False, index=True
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False)

    entrada_hora: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    entrada_lat: Mapped[float] = mapped_column(Float, nullable=False)
    entrada_lng: Mapped[float] = mapped_column(Float, nullable=False)
    entrada_precision_m: Mapped[float] = mapped_column(Float, nullable=False)
    entrada_foto_url: Mapped[str] = mapped_column(String(300), nullable=False)

    salida_hora: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    salida_lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    salida_lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    salida_precision_m: Mapped[float | None] = mapped_column(Float, nullable=True)
    salida_foto_url: Mapped[str | None] = mapped_column(String(300), nullable=True)

    horas_trabajadas: Mapped[float | None] = mapped_column(Float, nullable=True)
    estatus: Mapped[str] = mapped_column(String(20), nullable=False, default="activa")

    tecnico: Mapped["Usuario"] = relationship(foreign_keys=[tecnico_id])


class Cliente(Base):
    __tablename__ = "clientes"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    nombre: Mapped[str] = mapped_column(String(200), nullable=False)
    direccion: Mapped[str | None] = mapped_column(Text, nullable=True)
    telefono: Mapped[str | None] = mapped_column(String(20), nullable=True)


class Servicio(Base):
    __tablename__ = "servicios"
    __table_args__ = (
        CheckConstraint(
            "estatus IN ('pendiente','en_curso','completado','cancelado')",
            name="ck_servicios_estatus",
        ),
    )

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    cliente_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("clientes.id"), nullable=False, index=True
    )
    tecnico_id: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False, index=True
    )
    asignado_por: Mapped[uuid.UUID] = mapped_column(
        UUID(as_uuid=True), ForeignKey("usuarios.id"), nullable=False
    )
    fecha: Mapped[date] = mapped_column(Date, nullable=False)
    hora: Mapped[time | None] = mapped_column(Time, nullable=True)
    descripcion: Mapped[str] = mapped_column(String(300), nullable=False)
    estatus: Mapped[str] = mapped_column(String(20), nullable=False, default="pendiente")
    notas: Mapped[str | None] = mapped_column(Text, nullable=True)

    cliente: Mapped["Cliente"] = relationship()
    tecnico: Mapped["Usuario"] = relationship(foreign_keys=[tecnico_id])


class Config(Base):
    """
    Singleton branding/config row (always id=1). Exposed publicly (read-only)
    via GET /config so both frontends can theme themselves on load, and
    editable by admins via PUT /admin/config + POST /admin/config/logo.
    """

    __tablename__ = "config"

    id: Mapped[int] = mapped_column(primary_key=True, default=1)
    company_name: Mapped[str] = mapped_column(String(120), nullable=False, default="field-check")
    primary_color: Mapped[str] = mapped_column(String(7), nullable=False, default="#1F5FA5")
    secondary_color: Mapped[str] = mapped_column(String(7), nullable=False, default="#1D9E75")
    accent_color: Mapped[str] = mapped_column(String(7), nullable=False, default="#F59E0B")
    logo_url: Mapped[str | None] = mapped_column(String(300), nullable=True)
    hora_inicio_jornada: Mapped[time | None] = mapped_column(Time, nullable=True)
    hora_limite_entrada: Mapped[time | None] = mapped_column(Time, nullable=True)
    actualizado_en: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )
