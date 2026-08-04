"""Admin: jornadas listing, attendance reports, técnicos, usuarios, clientes."""
import csv
import io
import uuid
from datetime import date, datetime, timedelta
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy import delete, select
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_admin
from models import Ausencia, Cliente, Config, Horario, Jornada, Usuario
from schemas import (
    AusenciaCreate,
    AusenciaOut,
    AusenciaResponder,
    ClienteCreate,
    ClienteOut,
    FaltaInjustificadaOut,
    HorarioOut,
    HorarioUpsert,
    JornadaAnalisis,
    JornadaConTecnico,
    JornadaPage,
    JornadaUpdate,
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

AUSENCIA_TIPO_LABELS = {
    "falta": "Falta",
    "vacaciones": "Vacaciones",
    "permiso_con_goce": "Permiso con goce",
    "permiso_sin_goce": "Permiso sin goce",
    "incapacidad": "Incapacidad",
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


@router.patch("/jornadas/{jornada_id}", response_model=JornadaConTecnico)
def actualizar_jornada(
    jornada_id: uuid.UUID,
    body: JornadaUpdate,
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
):
    jornada = db.get(Jornada, jornada_id)
    if jornada is None:
        raise HTTPException(status_code=404, detail="Jornada not found")

    zona = ZoneInfo(get_settings().business_timezone)
    entrada_hora = datetime.combine(jornada.fecha, body.entrada_hora, tzinfo=zona)
    salida_hora = (
        datetime.combine(jornada.fecha, body.salida_hora, tzinfo=zona)
        if body.salida_hora is not None
        else None
    )
    if salida_hora is not None and salida_hora <= entrada_hora:
        raise HTTPException(
            status_code=400,
            detail="La hora de salida debe ser posterior a la hora de entrada",
        )

    jornada.entrada_hora = entrada_hora
    jornada.salida_hora = salida_hora
    if salida_hora is not None:
        jornada.horas_trabajadas = round((salida_hora - entrada_hora).total_seconds() / 3600, 2)
        jornada.estatus = "completa"
    else:
        jornada.horas_trabajadas = None
        jornada.estatus = "activa" if jornada.fecha == date.today() else "sin_salida"

    db.commit()
    db.refresh(jornada)
    return JornadaConTecnico(
        **_jornada_dict(jornada),
        tecnico_nombre=jornada.tecnico.nombre,
        tecnico_email=jornada.tecnico.email,
    )


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

    ausencias = db.scalars(
        select(Ausencia)
        .where(
            Ausencia.tecnico_id == tecnico_id,
            Ausencia.fecha >= fecha_inicio,
            Ausencia.fecha <= fecha_fin,
        )
        .order_by(Ausencia.fecha)
    ).all()

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

    fechas_con_jornada = {j.fecha for j in jornadas}
    fechas_con_ausencia = {a.fecha for a in ausencias}
    fechas_falta_injustificada = []
    dia = fecha_inicio
    while dia <= fecha_fin:
        horario = horarios_por_dia.get(dia.weekday())
        if (
            horario is not None
            and horario.activo
            and dia not in fechas_con_jornada
            and dia not in fechas_con_ausencia
        ):
            fechas_falta_injustificada.append(dia)
        dia += timedelta(days=1)

    dias_vacaciones = sum(1 for a in ausencias if a.tipo == "vacaciones")
    dias_permiso = sum(1 for a in ausencias if a.tipo in ("permiso_con_goce", "permiso_sin_goce"))
    dias_incapacidad = sum(1 for a in ausencias if a.tipo == "incapacidad")

    return ReporteOut(
        tecnico=TecnicoResumen(id=tecnico.id, nombre=tecnico.nombre, email=tecnico.email),
        horas_totales=horas_totales,
        horas_esperadas_totales=round(horas_esperadas_totales, 2),
        horas_extra_totales=round(horas_extra_totales, 2),
        dias_trabajados=dias_trabajados,
        dias_puntuales=dias_puntuales,
        puntualidad_pct=puntualidad_pct,
        jornadas=jornadas_analisis,
        ausencias=ausencias,
        fechas_falta_injustificada=fechas_falta_injustificada,
        dias_faltados=len(fechas_falta_injustificada),
        dias_vacaciones=dias_vacaciones,
        dias_permiso=dias_permiso,
        dias_incapacidad=dias_incapacidad,
    )


def _calcular_faltas_injustificadas(
    db: Session,
    fecha_inicio: date,
    fecha_fin: date,
    tecnico_id: uuid.UUID | None = None,
) -> list[tuple[Usuario, date]]:
    """
    Every técnico's active weekly schedule (horarios) decides which weekdays are
    expected workdays; a day in range only counts as an unjustified falta if it's
    expected, in the past (today included), and has neither a jornada nor an
    ausencia. Shared by the CSV export and the calendar-facing endpoint below —
    same rule `reporte_tecnico` uses for a single técnico, generalized to many.
    """
    stmt = select(Jornada).where(Jornada.fecha >= fecha_inicio, Jornada.fecha <= fecha_fin)
    if tecnico_id:
        stmt = stmt.where(Jornada.tecnico_id == tecnico_id)
    jornadas = db.scalars(stmt).all()

    stmt_aus = select(Ausencia).where(Ausencia.fecha >= fecha_inicio, Ausencia.fecha <= fecha_fin)
    if tecnico_id:
        stmt_aus = stmt_aus.where(Ausencia.tecnico_id == tecnico_id)
    ausencias = db.scalars(stmt_aus).all()

    tecnicos_stmt = select(Usuario).where(Usuario.rol == "tecnico")
    if tecnico_id:
        tecnicos_stmt = tecnicos_stmt.where(Usuario.id == tecnico_id)
    tecnicos = db.scalars(tecnicos_stmt).all()

    horarios_por_tecnico_dia: dict[uuid.UUID, dict[int, Horario]] = {}
    for h in db.scalars(select(Horario).where(Horario.activo == True)).all():  # noqa: E712
        horarios_por_tecnico_dia.setdefault(h.tecnico_id, {})[h.dia_semana] = h

    fechas_con_jornada = {(j.tecnico_id, j.fecha) for j in jornadas}
    fechas_con_ausencia = {(a.tecnico_id, a.fecha) for a in ausencias}

    hoy = date.today()
    faltas_injustificadas: list[tuple[Usuario, date]] = []
    for t in tecnicos:
        horarios_dia = horarios_por_tecnico_dia.get(t.id)
        if not horarios_dia:
            continue
        dia = fecha_inicio
        while dia <= min(fecha_fin, hoy):
            if dia.weekday() in horarios_dia and (t.id, dia) not in fechas_con_jornada and (
                t.id,
                dia,
            ) not in fechas_con_ausencia:
                faltas_injustificadas.append((t, dia))
            dia += timedelta(days=1)
    return faltas_injustificadas


@router.get("/reportes/export/csv")
def exportar_reportes_csv(
    tecnico_id: uuid.UUID | None = None,
    fecha_inicio: date | None = None,
    fecha_fin: date | None = None,
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if fecha_fin is None:
        fecha_fin = date.today()
    if fecha_inicio is None:
        fecha_inicio = fecha_fin.replace(day=1)

    stmt = select(Jornada).where(Jornada.fecha >= fecha_inicio, Jornada.fecha <= fecha_fin)
    if tecnico_id:
        stmt = stmt.where(Jornada.tecnico_id == tecnico_id)
    jornadas = db.scalars(stmt.order_by(Jornada.fecha)).all()

    stmt_aus = select(Ausencia).where(Ausencia.fecha >= fecha_inicio, Ausencia.fecha <= fecha_fin)
    if tecnico_id:
        stmt_aus = stmt_aus.where(Ausencia.tecnico_id == tecnico_id)
    ausencias = db.scalars(stmt_aus.order_by(Ausencia.fecha)).all()

    faltas_injustificadas = _calcular_faltas_injustificadas(db, fecha_inicio, fecha_fin, tecnico_id)

    zona = ZoneInfo(get_settings().business_timezone)
    filas = []
    for j in jornadas:
        filas.append(
            (
                j.fecha,
                j.tecnico.nombre,
                [
                    j.tecnico.nombre,
                    j.fecha.strftime("%d/%m/%Y"),
                    "Jornada",
                    j.entrada_hora.astimezone(zona).strftime("%H:%M"),
                    j.salida_hora.astimezone(zona).strftime("%H:%M") if j.salida_hora else "",
                    j.horas_trabajadas if j.horas_trabajadas is not None else "",
                    ESTATUS_JORNADA_LABELS.get(j.estatus, j.estatus),
                    "",
                ],
            )
        )
    for a in ausencias:
        filas.append(
            (
                a.fecha,
                a.tecnico.nombre,
                [
                    a.tecnico.nombre,
                    a.fecha.strftime("%d/%m/%Y"),
                    AUSENCIA_TIPO_LABELS.get(a.tipo, a.tipo),
                    "",
                    "",
                    "",
                    "",
                    a.notas or "",
                ],
            )
        )
    for t, fecha in faltas_injustificadas:
        filas.append(
            (
                fecha,
                t.nombre,
                [t.nombre, fecha.strftime("%d/%m/%Y"), "Falta injustificada", "", "", "", "", ""],
            )
        )
    filas.sort(key=lambda f: (f[0], f[1]))

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["Técnico", "Fecha", "Tipo", "Entrada", "Salida", "Horas trabajadas", "Estatus", "Notas"]
    )
    for _, _, fila in filas:
        writer.writerow(fila)
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


def tecnicos_sin_checkin_hoy(db: Session) -> list[Usuario]:
    """
    Active técnicos with neither a jornada nor an approved ausencia today.
    Shared by the `/admin/sin-checkin-alerta` endpoint and
    `utils/scheduler.py`'s daily alert job — the scheduler calls this
    directly (in-process, no HTTP/auth round-trip needed).
    """
    hoy = date.today()
    tecnicos = db.scalars(
        select(Usuario).where(Usuario.rol == "tecnico", Usuario.activo == True)  # noqa: E712
    ).all()

    tecnicos_con_jornada = {
        j.tecnico_id
        for j in db.scalars(select(Jornada).where(Jornada.fecha == hoy)).all()
    }
    tecnicos_con_ausencia_aprobada = {
        a.tecnico_id
        for a in db.scalars(
            select(Ausencia).where(Ausencia.fecha == hoy, Ausencia.estatus == "aprobada")
        ).all()
    }

    return [
        t
        for t in tecnicos
        if t.id not in tecnicos_con_jornada and t.id not in tecnicos_con_ausencia_aprobada
    ]


@router.get("/sin-checkin-alerta", response_model=list[TecnicoResumen])
def listar_sin_checkin_alerta(_: Usuario = Depends(require_admin), db: Session = Depends(get_db)):
    """Internal endpoint for the scheduler's daily alert job (see utils/scheduler.py)."""
    return tecnicos_sin_checkin_hoy(db)


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


# ── Ausencias ────────────────────────────────────────────────────────────
@router.get("/ausencias", response_model=list[AusenciaOut])
def listar_ausencias(
    tecnico_id: uuid.UUID | None = None,
    fecha_inicio: date | None = None,
    fecha_fin: date | None = None,
    estatus: str | None = None,
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
):
    stmt = select(Ausencia)
    if tecnico_id:
        stmt = stmt.where(Ausencia.tecnico_id == tecnico_id)
    if fecha_inicio:
        stmt = stmt.where(Ausencia.fecha >= fecha_inicio)
    if fecha_fin:
        stmt = stmt.where(Ausencia.fecha <= fecha_fin)
    if estatus:
        stmt = stmt.where(Ausencia.estatus == estatus)
    return db.scalars(stmt.order_by(Ausencia.fecha)).all()


@router.post("/ausencias", response_model=AusenciaOut, status_code=status.HTTP_201_CREATED)
def crear_ausencia(
    body: AusenciaCreate,
    admin: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if db.get(Usuario, body.tecnico_id) is None:
        raise HTTPException(status_code=404, detail="Usuario not found")

    jornada_existente = db.scalar(
        select(Jornada).where(Jornada.tecnico_id == body.tecnico_id, Jornada.fecha == body.fecha)
    )
    if jornada_existente is not None:
        raise HTTPException(
            status_code=409, detail="Ya existe una jornada para ese técnico en esa fecha"
        )

    ausencia_existente = db.scalar(
        select(Ausencia).where(Ausencia.tecnico_id == body.tecnico_id, Ausencia.fecha == body.fecha)
    )
    if ausencia_existente is not None:
        raise HTTPException(
            status_code=409, detail="Ya existe una ausencia para ese técnico en esa fecha"
        )

    ausencia = Ausencia(
        tecnico_id=body.tecnico_id,
        fecha=body.fecha,
        tipo=body.tipo,
        notas=body.notas,
        creado_por=admin.id,
        estatus="aprobada",
    )
    db.add(ausencia)
    db.commit()
    db.refresh(ausencia)
    return ausencia


@router.patch("/ausencias/{ausencia_id}/responder", response_model=AusenciaOut)
def responder_ausencia(
    ausencia_id: uuid.UUID,
    body: AusenciaResponder,
    admin: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Approve/reject a técnico's self-requested ausencia (estatus='pendiente')."""
    ausencia = db.get(Ausencia, ausencia_id)
    if ausencia is None:
        raise HTTPException(status_code=404, detail="Ausencia not found")

    ausencia.estatus = body.estatus
    ausencia.respuesta_notas = body.respuesta_notas
    ausencia.respondida_por = admin.id
    db.commit()
    db.refresh(ausencia)
    return ausencia


@router.get("/ausencias/faltas-injustificadas", response_model=list[FaltaInjustificadaOut])
def listar_faltas_injustificadas(
    fecha_inicio: date,
    fecha_fin: date,
    tecnico_id: uuid.UUID | None = None,
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Auto-detected unjustified faltas in range, across técnicos — for the Calendario view."""
    faltas = _calcular_faltas_injustificadas(db, fecha_inicio, fecha_fin, tecnico_id)
    return [
        FaltaInjustificadaOut(tecnico_id=t.id, tecnico_nombre=t.nombre, fecha=fecha)
        for t, fecha in faltas
    ]


@router.delete("/ausencias/{ausencia_id}", status_code=status.HTTP_204_NO_CONTENT)
def eliminar_ausencia(
    ausencia_id: uuid.UUID, _: Usuario = Depends(require_admin), db: Session = Depends(get_db)
):
    ausencia = db.get(Ausencia, ausencia_id)
    if ausencia is None:
        raise HTTPException(status_code=404, detail="Ausencia not found")
    db.delete(ausencia)
    db.commit()


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
