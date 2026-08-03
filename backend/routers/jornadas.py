"""
Worker attendance: check-in / check-out.

Only two events per jornada, one jornada per worker per day (enforced by the
DB unique constraint on tecnico_id+fecha). `precision_m` is stored purely as
informational context for the admin — it is never read here to accept or
reject a check-in (see CONTEXT_CHECADOR.md hard rules).
"""
from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_tecnico
from models import Jornada, Usuario
from schemas import JornadaOut
from utils.fotos import save_photo

router = APIRouter(tags=["jornadas"])


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
