"""Admin: jornadas listing, attendance reports, técnicos, usuarios, clientes."""
import csv
import io
import uuid
from datetime import date, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_admin
from models import Cliente, Config, Horario, Jornada, Usuario
from schemas import (
    ClienteCreate,
    ClienteOut,
    HorarioOut,
    HorarioUpsert,
    JornadaAnalisis,
    JornadaConTecnico,
    JornadaPage,
    ReporteOut,
    TecnicoResumen,
    UsuarioCreate,
    UsuarioOut,
    UsuarioUpdate,
)
from settings import get_settings
from utils.puntualidad import analizar_jornada, calcular_puntualidad_pct
from utils.security import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])

ESTATUS_JORNADA_LABELS = {
    "activa": "En jornada",
    "completa": "Completa",
    "sin_salida": "Sin salida",
}


# ── Jornadas (read) ───────────────────────────────────────────────────────
@router.get("/jornadas", response_model=JornadaPage)
def listar_jornadas(
    tecnico_id: uuid.UUID | None = None,
    fecha_inicio: date | None = None,
    fecha_fin: date | None = None,
    page: int = 1,
    limit: int = 20,
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
):
    stmt = select(Jornada)
    if tecnico_id:
        stmt = stmt.where(Jornada.tecnico_id == tecnico_id)
    if fecha_inicio:
        stmt = stmt.where(Jornada.fecha >= fecha_inicio)
    if fecha_fin:
        stmt = stmt.where(Jornada.fecha <= fecha_fin)

    total = len(db.scalars(stmt).all())
    page = max(page, 1)
    limit = max(min(limit, 100), 1)
    jornadas = db.scalars(
        stmt.order_by(Jornada.fecha.desc()).offset((page - 1) * limit).limit(limit)
    ).all()

    items = [
        JornadaConTecnico(
            **_jornada_dict(j),
            tecnico_nombre=j.tecnico.nombre,
            tecnico_email=j.tecnico.email,
        )
        for j in jornadas
    ]
    return JornadaPage(items=items, total=total, page=page, limit=limit)


def _jornada_dict(j: Jornada) -> dict:
    return {
        "id": j.id,
        "tecnico_id": j.tecnico_id,
        "fecha": j.fecha,
        "entrada_hora": j.entrada_hora,
        "entrada_lat": j.entrada_lat,
        "entrada_lng": j.entrada_lng,
        "entrada_precision_m": j.entrada_precision_m,
        "entrada_foto_url": j.entrada_foto_url,
        "salida_hora": j.salida_hora,
        "salida_lat": j.salida_lat,
        "salida_lng": j.salida_lng,
        "salida_precision_m": j.salida_precision_m,
        "salida_foto_url": j.salida_foto_url,
        "horas_trabajadas": j.horas_trabajadas,
        "estatus": j.estatus,
    }


# ── Reportes ──────────────────────────────────────────────────────────────
@router.get("/reportes", response_model=ReporteOut)
def reporte_tecnico(
    tecnico_id: uuid.UUID,
    fecha_inicio: date | None = None,
    fecha_fin: date | None = None,
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
):
    tecnico = db.get(Usuario, tecnico_id)
    if tecnico is None:
        raise HTTPException(status_code=404, detail="Técnico not found")

    if fecha_fin is None:
        fecha_fin = date.today()
    if fecha_inicio is None:
        fecha_inicio = fecha_fin.replace(day=1)

    stmt = select(Jornada).where(
        Jornada.tecnico_id == tecnico_id,
        Jornada.fecha >= fecha_inicio,
        Jornada.fecha <= fecha_fin,
    )
    jornadas = db.scalars(stmt.order_by(Jornada.fecha)).all()

    config = db.get(Config, 1)
    hora_limite_cfg = config.hora_limite_entrada if config else None
    horarios_por_dia = {
        h.dia_semana: h
        for h in db.scalars(
            select(Horario).where(Horario.tecnico_id == tecnico_id, Horario.activo == True)  # noqa: E712
        ).all()
    }

    jornadas_analisis = []
    horas_esperadas_totales = 0.0
    horas_extra_totales = 0.0
    dias_puntuales = 0
    for j in jornadas:
        resultado = analizar_jornada(
            entrada_hora=j.entrada_hora,
            salida_hora=j.salida_hora,
            horas_trabajadas=j.horas_trabajadas,
            fecha=j.fecha,
            horario=horarios_por_dia.get(j.fecha.weekday()),
            hora_limite_cfg=hora_limite_cfg,
        )
        horas_esperadas_totales += resultado.horas_esperadas or 0
        horas_extra_totales += resultado.horas_extra or 0
        if resultado.puntual:
            dias_puntuales += 1
        jornadas_analisis.append(
            JornadaAnalisis(
                **_jornada_dict(j),
                dia_semana=resultado.dia_semana,
                horas_esperadas=resultado.horas_esperadas,
                horas_extra=resultado.horas_extra,
                entro_antes=resultado.entro_antes,
                salio_despues=resultado.salio_despues,
                salio_antes=resultado.salio_antes,
                puntual=resultado.puntual,
            )
        )

    horas_totales = round(sum(j.horas_trabajadas or 0 for j in jornadas), 2)
    dias_trabajados = len(jornadas)
    puntualidad_pct = calcular_puntualidad_pct(
        [j.entrada_hora for j in jornadas],
        hora_limite_cfg,
    )

    return ReporteOut(
        tecnico=TecnicoResumen(id=tecnico.id, nombre=tecnico.nombre, email=tecnico.email),
        horas_totales=horas_totales,
        horas_esperadas_totales=round(horas_esperadas_totales, 2),
        horas_extra_totales=round(horas_extra_totales, 2),
        dias_trabajados=dias_trabajados,
        dias_puntuales=dias_puntuales,
        puntualidad_pct=puntualidad_pct,
        jornadas=jornadas_analisis,
    )


@router.get("/reportes/export/csv")
def exportar_reportes_csv(
    tecnico_id: uuid.UUID | None = None,
    fecha_inicio: date | None = None,
    fecha_fin: date | None = None,
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
):
    stmt = select(Jornada)
    if tecnico_id:
        stmt = stmt.where(Jornada.tecnico_id == tecnico_id)
    if fecha_inicio:
        stmt = stmt.where(Jornada.fecha >= fecha_inicio)
    if fecha_fin:
        stmt = stmt.where(Jornada.fecha <= fecha_fin)
    jornadas = db.scalars(stmt.order_by(Jornada.fecha)).all()

    zona = ZoneInfo(get_settings().business_timezone)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(["Técnico", "Fecha", "Entrada", "Salida", "Horas trabajadas", "Estatus"])
    for j in jornadas:
        writer.writerow(
            [
                j.tecnico.nombre,
                j.fecha.strftime("%d/%m/%Y"),
                j.entrada_hora.astimezone(zona).strftime("%H:%M"),
                j.salida_hora.astimezone(zona).strftime("%H:%M") if j.salida_hora else "",
                j.horas_trabajadas if j.horas_trabajadas is not None else "",
                ESTATUS_JORNADA_LABELS.get(j.estatus, j.estatus),
            ]
        )
    buffer.seek(0)

    return StreamingResponse(
        iter(["﻿" + buffer.getvalue()]),  # BOM so Excel renders accents correctly
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=reporte_asistencia.csv"},
    )


# ── Técnicos ─────────────────────────────────────────────────────────────
@router.get("/tecnicos", response_model=list[UsuarioOut])
def listar_tecnicos(_: Usuario = Depends(require_admin), db: Session = Depends(get_db)):
    return db.scalars(
        select(Usuario).where(Usuario.rol == "tecnico", Usuario.activo == True)  # noqa: E712
    ).all()


# ── Usuarios ─────────────────────────────────────────────────────────────
@router.get("/usuarios", response_model=list[UsuarioOut])
def listar_usuarios(_: Usuario = Depends(require_admin), db: Session = Depends(get_db)):
    return db.scalars(select(Usuario).order_by(Usuario.nombre)).all()


@router.post("/usuarios", response_model=UsuarioOut, status_code=status.HTTP_201_CREATED)
def crear_usuario(
    body: UsuarioCreate, _: Usuario = Depends(require_admin), db: Session = Depends(get_db)
):
    existente = db.scalar(select(Usuario).where(Usuario.email == body.email))
    if existente is not None:
        raise HTTPException(status_code=409, detail="Email already registered")

    usuario = Usuario(
        nombre=body.nombre,
        email=body.email,
        password_hash=hash_password(body.password),
        rol=body.rol,
    )
    db.add(usuario)
    db.commit()
    db.refresh(usuario)
    return usuario


@router.patch("/usuarios/{usuario_id}", response_model=UsuarioOut)
def actualizar_usuario(
    usuario_id: uuid.UUID,
    body: UsuarioUpdate,
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
):
    usuario = db.get(Usuario, usuario_id)
    if usuario is None:
        raise HTTPException(status_code=404, detail="Usuario not found")

    updates = body.model_dump(exclude_unset=True)
    if "email" in updates and updates["email"] != usuario.email:
        existente = db.scalar(select(Usuario).where(Usuario.email == updates["email"]))
        if existente is not None:
            raise HTTPException(status_code=409, detail="Email already registered")

    for field, value in updates.items():
        setattr(usuario, field, value)
    db.commit()
    db.refresh(usuario)
    return usuario


# ── Horarios (weekly expected schedule) ─────────────────────────────────────
@router.get("/usuarios/{usuario_id}/horarios", response_model=list[HorarioOut])
def listar_horarios(
    usuario_id: uuid.UUID, _: Usuario = Depends(require_admin), db: Session = Depends(get_db)
):
    if db.get(Usuario, usuario_id) is None:
        raise HTTPException(status_code=404, detail="Usuario not found")
    return db.scalars(
        select(Horario).where(Horario.tecnico_id == usuario_id).order_by(Horario.dia_semana)
    ).all()


@router.put("/usuarios/{usuario_id}/horarios", response_model=list[HorarioOut])
def actualizar_horarios(
    usuario_id: uuid.UUID,
    body: list[HorarioUpsert],
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Full replace: the given rows become the técnico's entire weekly schedule."""
    if db.get(Usuario, usuario_id) is None:
        raise HTTPException(status_code=404, detail="Usuario not found")

    dias = [h.dia_semana for h in body]
    if len(dias) != len(set(dias)):
        raise HTTPException(status_code=400, detail="dia_semana repetido en la lista")

    db.execute(delete(Horario).where(Horario.tecnico_id == usuario_id))
    nuevos = [
        Horario(
            tecnico_id=usuario_id,
            dia_semana=h.dia_semana,
            hora_inicio=h.hora_inicio,
            hora_fin=h.hora_fin,
            activo=h.activo,
        )
        for h in body
    ]
    db.add_all(nuevos)
    db.commit()
    for h in nuevos:
        db.refresh(h)
    return sorted(nuevos, key=lambda h: h.dia_semana)


# ── Clientes ─────────────────────────────────────────────────────────────
@router.get("/clientes", response_model=list[ClienteOut])
def listar_clientes(_: Usuario = Depends(require_admin), db: Session = Depends(get_db)):
    return db.scalars(select(Cliente).order_by(Cliente.nombre)).all()


@router.post("/clientes", response_model=ClienteOut, status_code=status.HTTP_201_CREATED)
def crear_cliente(
    body: ClienteCreate, _: Usuario = Depends(require_admin), db: Session = Depends(get_db)
):
    cliente = Cliente(**body.model_dump())
    db.add(cliente)
    db.commit()
    db.refresh(cliente)
    return cliente
