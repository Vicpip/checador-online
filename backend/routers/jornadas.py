"""
Worker attendance: check-in / check-out.

Only two events per jornada, one jornada per worker per day (enforced by the
DB unique constraint on tecnico_id+fecha). `precision_m` is stored purely as
informational context for the admin — it is never read here to accept or
reject a check-in (see CONTEXT_CHECADOR.md hard rules).
"""
import logging
from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_tecnico
from models import Ausencia, Config, Jornada, Usuario
from routers.admin import AUSENCIA_TIPO_LABELS
from schemas import AusenciaOut, JornadaOut
from settings import get_settings
from utils.email import render_email, send_email
from utils.fotos import save_photo

logger = logging.getLogger(__name__)

router = APIRouter(tags=["jornadas"])

MAX_DIAS_HISTORIAL = 90

# Técnicos can only self-request these — 'falta' stays admin-only (it records an
# already-happened unexcused absence, not something a worker would request).
TIPO_PERMISO_TECNICO_PATTERN = "^(vacaciones|permiso_con_goce|permiso_sin_goce|incapacidad)$"


class AusenciaTecnicoCreate(BaseModel):
    fecha: date
    tipo: str = Field(pattern=TIPO_PERMISO_TECNICO_PATTERN)
    notas: str | None = None


@router.get("/me/jornada/hoy", response_model=JornadaOut | None)
def jornada_hoy(
    user: Usuario = Depends(require_tecnico),
    db: Session = Depends(get_db),
):
    hoy = date.today()
    jornada = db.scalar(
        select(Jornada).where(Jornada.tecnico_id == user.id, Jornada.fecha == hoy)
    )
    return jornada


@router.get("/jornadas/historial", response_model=list[JornadaOut])
def historial_jornadas(
    fecha_inicio: date | None = None,
    fecha_fin: date | None = None,
    user: Usuario = Depends(require_tecnico),
    db: Session = Depends(get_db),
):
    if fecha_fin is None:
        fecha_fin = date.today()
    if fecha_inicio is None:
        fecha_inicio = fecha_fin - timedelta(days=MAX_DIAS_HISTORIAL - 1)

    if fecha_inicio > fecha_fin:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="fecha_inicio must not be after fecha_fin",
        )
    if (fecha_fin - fecha_inicio).days >= MAX_DIAS_HISTORIAL:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Range cannot exceed {MAX_DIAS_HISTORIAL} days",
        )

    stmt = select(Jornada).where(
        Jornada.tecnico_id == user.id,
        Jornada.fecha >= fecha_inicio,
        Jornada.fecha <= fecha_fin,
    )
    return db.scalars(stmt.order_by(Jornada.fecha.desc())).all()


@router.post("/jornadas/checkin", response_model=JornadaOut, status_code=status.HTTP_201_CREATED)
def checkin(
    foto: UploadFile = File(...),
    lat: float = Form(...),
    lng: float = Form(...),
    precision_m: float = Form(...),
    user: Usuario = Depends(require_tecnico),
    db: Session = Depends(get_db),
):
    hoy = date.today()
    existente = db.scalar(
        select(Jornada).where(Jornada.tecnico_id == user.id, Jornada.fecha == hoy)
    )
    if existente is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Check-in already exists for today",
        )

    ahora = datetime.now(timezone.utc)
    foto_url = save_photo(foto, tipo="in", fecha=hoy)

    jornada = Jornada(
        tecnico_id=user.id,
        fecha=hoy,
        entrada_hora=ahora,
        entrada_lat=lat,
        entrada_lng=lng,
        entrada_precision_m=precision_m,
        entrada_foto_url=foto_url,
        estatus="activa",
    )
    db.add(jornada)
    db.commit()
    db.refresh(jornada)
    return jornada


@router.post("/jornadas/checkout", response_model=JornadaOut)
def checkout(
    foto: UploadFile = File(...),
    lat: float = Form(...),
    lng: float = Form(...),
    precision_m: float = Form(...),
    user: Usuario = Depends(require_tecnico),
    db: Session = Depends(get_db),
):
    hoy = date.today()
    jornada = db.scalar(
        select(Jornada).where(
            Jornada.tecnico_id == user.id,
            Jornada.fecha == hoy,
            Jornada.estatus == "activa",
        )
    )
    if jornada is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active check-in found for today",
        )

    ahora = datetime.now(timezone.utc)
    foto_url = save_photo(foto, tipo="out", fecha=hoy)

    jornada.salida_hora = ahora
    jornada.salida_lat = lat
    jornada.salida_lng = lng
    jornada.salida_precision_m = precision_m
    jornada.salida_foto_url = foto_url
    jornada.horas_trabajadas = round(
        (ahora - jornada.entrada_hora).total_seconds() / 3600, 2
    )
    jornada.estatus = "completa"

    db.commit()
    db.refresh(jornada)
    return jornada


def _notificar_solicitud_permiso(db: Session, request: Request, user: Usuario, ausencia: Ausencia) -> None:
    settings = get_settings()
    logger.warning(
        "[EMAIL DEBUG] _notificar_solicitud_permiso: ausencia_id=%s tecnico=%s admin_emails=%r",
        ausencia.id, user.nombre, settings.admin_emails,
    )
    if not settings.admin_emails:
        logger.warning(
            "[EMAIL DEBUG] settings.admin_emails está vacío — no se enviará notificación "
            "(revisa la variable ADMIN_EMAILS en el .env del contenedor)"
        )
        return

    config = db.get(Config, 1)
    company_name = config.company_name if config else settings.app_name
    primary_color = config.primary_color if config else "#1F5FA5"
    logo_url = config.logo_url if config else None

    origin = request.headers.get("origin")
    if origin:
        link_html = (
            f'<p><a href="{origin}" style="display:inline-block; padding:10px 20px; '
            f'background-color:{primary_color}; color:#FFFFFF; text-decoration:none; '
            f'border-radius:6px; font-weight:bold;">Revisar en el panel de administración</a></p>'
        )
    else:
        link_html = "<p>Revisa la solicitud en el panel de administración.</p>"

    notas_html = f"<p><strong>Notas:</strong> {ausencia.notas}</p>" if ausencia.notas else ""

    body_html = f"""
        <p><strong>Técnico:</strong> {user.nombre}</p>
        <p><strong>Tipo de permiso:</strong> {AUSENCIA_TIPO_LABELS.get(ausencia.tipo, ausencia.tipo)}</p>
        <p><strong>Fecha:</strong> {ausencia.fecha.strftime("%d/%m/%Y")}</p>
        {notas_html}
        {link_html}
    """
    html = render_email(company_name, "Nueva solicitud de permiso", body_html, primary_color, logo_url)
    subject = f"Nueva solicitud de permiso — {user.nombre}"
    logger.warning(
        "[EMAIL DEBUG] llamando a send_email(to=%r, subject=%r)",
        settings.admin_emails, subject,
    )
    send_email(
        to=settings.admin_emails,
        subject=subject,
        html=html,
    )
    logger.warning("[EMAIL DEBUG] send_email() retornó (encoló el envío en background thread)")


@router.post("/jornadas/ausencias", response_model=AusenciaOut, status_code=status.HTTP_201_CREATED)
def solicitar_permiso(
    body: AusenciaTecnicoCreate,
    request: Request,
    user: Usuario = Depends(require_tecnico),
    db: Session = Depends(get_db),
):
    """
    Técnico self-service version of admin.py::crear_ausencia — same 409 rules
    (no jornada and no ausencia already on that date), restricted to the tipos
    a worker may request for themselves (see TIPO_PERMISO_TECNICO_PATTERN).
    """
    jornada_existente = db.scalar(
        select(Jornada).where(Jornada.tecnico_id == user.id, Jornada.fecha == body.fecha)
    )
    if jornada_existente is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya tienes una jornada registrada en esa fecha",
        )

    ausencia_existente = db.scalar(
        select(Ausencia).where(Ausencia.tecnico_id == user.id, Ausencia.fecha == body.fecha)
    )
    if ausencia_existente is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una solicitud registrada en esa fecha",
        )

    ausencia = Ausencia(
        tecnico_id=user.id,
        fecha=body.fecha,
        tipo=body.tipo,
        notas=body.notas,
        creado_por=user.id,
        estatus="pendiente",
    )
    db.add(ausencia)
    db.commit()
    db.refresh(ausencia)

    _notificar_solicitud_permiso(db, request, user, ausencia)

    return ausencia


@router.get("/jornadas/ausencias", response_model=list[AusenciaOut])
def mis_ausencias(
    user: Usuario = Depends(require_tecnico),
    db: Session = Depends(get_db),
):
    """The authenticated técnico's own ausencia requests, newest first."""
    stmt = select(Ausencia).where(Ausencia.tecnico_id == user.id)
    return db.scalars(stmt.order_by(Ausencia.fecha.desc())).all()
