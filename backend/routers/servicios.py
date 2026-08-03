"""
Servicios: work assignments / schedule.

Intentionally decoupled from jornadas — no FK, no cross-reads. A worker's
schedule and their attendance are managed independently.
"""
import uuid
from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_admin, require_tecnico
from models import Cliente, Servicio, Usuario
from schemas import ServicioConDetalle, ServicioCreate, ServicioOut, ServicioUpdate

router = APIRouter(tags=["servicios"])


def _to_detalle(s: Servicio) -> ServicioConDetalle:
    return ServicioConDetalle(
        id=s.id,
        cliente_id=s.cliente_id,
        tecnico_id=s.tecnico_id,
        asignado_por=s.asignado_por,
        fecha=s.fecha,
        hora=s.hora,
        descripcion=s.descripcion,
        estatus=s.estatus,
        notas=s.notas,
        cliente_nombre=s.cliente.nombre,
        tecnico_nombre=s.tecnico.nombre,
    )


# ── Worker ────────────────────────────────────────────────────────────────
@router.get("/me/servicios", response_model=list[ServicioConDetalle])
def mis_servicios(
    fecha: date | None = None,
    user: Usuario = Depends(require_tecnico),
    db: Session = Depends(get_db),
):
    if fecha is not None:
        stmt = select(Servicio).where(Servicio.tecnico_id == user.id, Servicio.fecha == fecha)
    else:
        hoy = date.today()
        inicio_semana = hoy - timedelta(days=hoy.weekday())
        fin_semana = inicio_semana + timedelta(days=6)
        stmt = select(Servicio).where(
            Servicio.tecnico_id == user.id,
            Servicio.fecha >= inicio_semana,
            Servicio.fecha <= fin_semana,
        )
    servicios = db.scalars(stmt.order_by(Servicio.fecha)).all()
    return [_to_detalle(s) for s in servicios]


# ── Admin ─────────────────────────────────────────────────────────────────
@router.get("/admin/servicios", response_model=list[ServicioConDetalle])
def listar_servicios(
    tecnico_id: uuid.UUID | None = None,
    cliente_id: uuid.UUID | None = None,
    fecha_inicio: date | None = None,
    fecha_fin: date | None = None,
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
):
    stmt = select(Servicio)
    if tecnico_id:
        stmt = stmt.where(Servicio.tecnico_id == tecnico_id)
    if cliente_id:
        stmt = stmt.where(Servicio.cliente_id == cliente_id)
    if fecha_inicio:
        stmt = stmt.where(Servicio.fecha >= fecha_inicio)
    if fecha_fin:
        stmt = stmt.where(Servicio.fecha <= fecha_fin)
    servicios = db.scalars(stmt.order_by(Servicio.fecha)).all()
    return [_to_detalle(s) for s in servicios]


@router.post("/admin/servicios", response_model=ServicioOut, status_code=status.HTTP_201_CREATED)
def crear_servicio(
    body: ServicioCreate,
    user: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if db.get(Cliente, body.cliente_id) is None:
        raise HTTPException(status_code=404, detail="Cliente not found")
    tecnico = db.get(Usuario, body.tecnico_id)
    if tecnico is None or tecnico.rol != "tecnico":
        raise HTTPException(status_code=404, detail="Técnico not found")

    servicio = Servicio(
        cliente_id=body.cliente_id,
        tecnico_id=body.tecnico_id,
        asignado_por=user.id,
        fecha=body.fecha,
        hora=body.hora,
        descripcion=body.descripcion,
        notas=body.notas,
    )
    db.add(servicio)
    db.commit()
    db.refresh(servicio)
    return servicio


@router.put("/admin/servicios/{servicio_id}", response_model=ServicioOut)
def actualizar_servicio(
    servicio_id: uuid.UUID,
    body: ServicioUpdate,
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
):
    servicio = db.get(Servicio, servicio_id)
    if servicio is None:
        raise HTTPException(status_code=404, detail="Servicio not found")

    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(servicio, field, value)

    db.commit()
    db.refresh(servicio)
    return servicio


@router.delete("/admin/servicios/{servicio_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_servicio(
    servicio_id: uuid.UUID,
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
):
    servicio = db.get(Servicio, servicio_id)
    if servicio is None:
        raise HTTPException(status_code=404, detail="Servicio not found")
    db.delete(servicio)
    db.commit()
