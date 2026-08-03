"""Pydantic v2 request/response schemas."""
import uuid
from datetime import date, datetime, time

from pydantic import BaseModel, ConfigDict, EmailStr, Field


# ── Auth ──────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    rol: str
    nombre: str


# ── Usuarios ──────────────────────────────────────────────────────────────
class UsuarioBase(BaseModel):
    nombre: str
    email: EmailStr
    rol: str = Field(pattern="^(admin|tecnico)$")


class UsuarioCreate(UsuarioBase):
    password: str = Field(min_length=8)


class UsuarioOut(UsuarioBase):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    activo: bool
    creado_en: datetime


class UsuarioUpdate(BaseModel):
    nombre: str | None = None
    email: EmailStr | None = None
    activo: bool | None = None


# ── Horarios ──────────────────────────────────────────────────────────────
class HorarioUpsert(BaseModel):
    dia_semana: int = Field(ge=0, le=6)
    hora_inicio: time
    hora_fin: time
    activo: bool = True


class HorarioOut(HorarioUpsert):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tecnico_id: uuid.UUID


# ── Ausencias ─────────────────────────────────────────────────────────────
AUSENCIA_TIPO_PATTERN = "^(falta|vacaciones|permiso_con_goce|permiso_sin_goce|incapacidad)$"


class AusenciaCreate(BaseModel):
    tecnico_id: uuid.UUID
    fecha: date
    tipo: str = Field(pattern=AUSENCIA_TIPO_PATTERN)
    notas: str | None = None


class AusenciaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tecnico_id: uuid.UUID
    fecha: date
    tipo: str
    notas: str | None
    creado_por: uuid.UUID
    creado_en: datetime


class FaltaInjustificadaOut(BaseModel):
    """An auto-detected unjustified falta — no DB row, computed on the fly. See
    routers/admin.py::_calcular_faltas_injustificadas."""

    tecnico_id: uuid.UUID
    tecnico_nombre: str
    fecha: date


# ── Clientes ──────────────────────────────────────────────────────────────
class ClienteBase(BaseModel):
    nombre: str
    direccion: str | None = None
    telefono: str | None = None


class ClienteCreate(ClienteBase):
    pass


class ClienteOut(ClienteBase):
    model_config = ConfigDict(from_attributes=True)
    id: uuid.UUID


# ── Jornadas ──────────────────────────────────────────────────────────────
class JornadaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    tecnico_id: uuid.UUID
    fecha: date
    entrada_hora: datetime
    entrada_lat: float
    entrada_lng: float
    entrada_precision_m: float
    entrada_foto_url: str
    salida_hora: datetime | None
    salida_lat: float | None
    salida_lng: float | None
    salida_precision_m: float | None
    salida_foto_url: str | None
    horas_trabajadas: float | None
    estatus: str


class JornadaConTecnico(JornadaOut):
    tecnico_nombre: str
    tecnico_email: str


class JornadaPage(BaseModel):
    items: list[JornadaConTecnico]
    total: int
    page: int
    limit: int


# ── Servicios ─────────────────────────────────────────────────────────────
class ServicioCreate(BaseModel):
    cliente_id: uuid.UUID
    tecnico_id: uuid.UUID
    fecha: date
    hora: time | None = None
    descripcion: str = Field(max_length=300)
    notas: str | None = None


class ServicioUpdate(BaseModel):
    estatus: str | None = Field(default=None, pattern="^(pendiente|en_curso|completado|cancelado)$")
    descripcion: str | None = Field(default=None, max_length=300)
    notas: str | None = None
    fecha: date | None = None
    hora: time | None = None


class ServicioOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: uuid.UUID
    cliente_id: uuid.UUID
    tecnico_id: uuid.UUID
    asignado_por: uuid.UUID
    fecha: date
    hora: time | None
    descripcion: str
    estatus: str
    notas: str | None


class ServicioConDetalle(ServicioOut):
    cliente_nombre: str
    tecnico_nombre: str


# ── Reportes ──────────────────────────────────────────────────────────────
class TecnicoResumen(BaseModel):
    id: uuid.UUID
    nombre: str
    email: str


class JornadaAnalisis(JornadaOut):
    """JornadaOut plus a comparison of actual vs. expected hours for that day."""

    dia_semana: int
    horas_esperadas: float | None
    horas_extra: float | None
    entro_antes: bool | None
    salio_despues: bool | None
    salio_antes: bool | None
    puntual: bool


class ReporteOut(BaseModel):
    tecnico: TecnicoResumen
    horas_totales: float
    horas_esperadas_totales: float
    horas_extra_totales: float
    dias_trabajados: int
    dias_puntuales: int
    puntualidad_pct: float
    jornadas: list[JornadaAnalisis]
    ausencias: list[AusenciaOut]
    fechas_falta_injustificada: list[date]
    dias_faltados: int
    dias_vacaciones: int
    dias_permiso: int
    dias_incapacidad: int


# ── Config / Branding ───────────────────────────────────────────────────
class ConfigOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    company_name: str
    primary_color: str
    secondary_color: str
    accent_color: str
    logo_url: str | None
    worker_role_label: str
    admin_role_label: str
    hora_inicio_jornada: time
    hora_limite_entrada: time


class ConfigUpdate(BaseModel):
    company_name: str | None = Field(default=None, max_length=120)
    primary_color: str | None = Field(default=None, pattern="^#[0-9A-Fa-f]{6}$")
    secondary_color: str | None = Field(default=None, pattern="^#[0-9A-Fa-f]{6}$")
    accent_color: str | None = Field(default=None, pattern="^#[0-9A-Fa-f]{6}$")
    hora_inicio_jornada: time | None = None
    hora_limite_entrada: time | None = None
