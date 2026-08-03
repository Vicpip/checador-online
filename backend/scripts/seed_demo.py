"""
Demo data seeder — creates realistic users/schedules/jornadas/servicios so
the Reportes/Jornadas/Calendario admin pages have something meaningful to
show. Not part of the app's runtime; run it by hand against a fresh (or
existing) database.

Idempotent at the *user* level: técnicos/admin are matched by email. A user
that already exists is left untouched and none of its dependent data
(horarios/jornadas/servicios) is regenerated — re-running unconditionally
would also crash on the second pass since `jornadas` has a UNIQUE constraint
on (tecnico_id, fecha). Clientes are matched by nombre and reused the same
way. So: first run seeds everything, later runs are a safe no-op unless you
add a new user/cliente to the lists below.

Uses the same DATABASE_URL as the app (settings.py -> os.environ, populated
by docker-compose's `env_file: .env`) — no separate config needed. Run
inside the backend container:

    docker compose exec backend python scripts/seed_demo.py
"""
import base64
import os
import random
import sys
from datetime import date, datetime, time, timedelta, timezone
from uuid import uuid4
from zoneinfo import ZoneInfo

# This file lives in scripts/, but `database`/`models`/etc. live one level up
# in /app — put that directory on sys.path regardless of cwd.
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from database import SessionLocal  # noqa: E402
from models import Cliente, Horario, Jornada, Servicio, Usuario  # noqa: E402
from settings import get_settings  # noqa: E402
from utils.security import hash_password  # noqa: E402

settings = get_settings()
TZ = ZoneInfo(settings.business_timezone)
DEMO_PASSWORD = "Demo2026!"
DIAS_HISTORIA = 30

USUARIOS = [
    {"nombre": "Victor", "email": "victor@demo.com", "rol": "admin"},
    {"nombre": "Carlos Mendoza", "email": "carlos@demo.com", "rol": "tecnico"},
    {"nombre": "Ana Ramírez", "email": "ana@demo.com", "rol": "tecnico"},
    {"nombre": "Luis Torres", "email": "luis@demo.com", "rol": "tecnico"},
]

CLIENTES = ["Smurfit Kappa", "Cooper Standard", "Grupo Bimbo"]

DESCRIPCIONES = [
    "Mantenimiento preventivo de línea",
    "Instalación de equipo",
    "Revisión de sensores",
    "Soporte técnico en sitio",
    "Diagnóstico de falla eléctrica",
    "Calibración de maquinaria",
    "Inspección de seguridad",
    "Reemplazo de componente",
    "Levantamiento de requerimientos",
]

# Rough job-site coordinates (central-Mexico industrial corridor) — small
# jitter is added per check-in/out so points don't all land on one pixel.
BASE_LAT, BASE_LNG = 20.5888, -100.3899

# Smallest valid 1x1 JPEG (white pixel) — written to disk as a stand-in photo
# so the admin "ver foto" modal has a real image to load instead of a 404.
_PLACEHOLDER_JPEG = base64.b64decode(
    "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgK"
    "CgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkL"
    "EBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAAR"
    "CAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAj/xAAUEAEAAAAAAAAAAAAA"
    "AAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAAAAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oA"
    "DAMBAAIRAxEAPwCdABmX/9k="
)


def jitter(base: float, spread: float = 0.01) -> float:
    return round(base + random.uniform(-spread, spread), 6)


def write_placeholder_photo(fecha: date, tipo: str) -> str:
    """Write a tiny real JPEG under fotos_base_path, same relative-path
    convention as utils.fotos.save_photo, so served photos aren't 404s."""
    rel = f"{fecha.year}/{fecha.month:02d}/{fecha.day:02d}/{uuid4()}-{tipo}.jpg"
    try:
        path = os.path.join(settings.fotos_base_path, rel)
        os.makedirs(os.path.dirname(path), exist_ok=True)
        with open(path, "wb") as f:
            f.write(_PLACEHOLDER_JPEG)
    except OSError as exc:
        print(f"  (warning: could not write placeholder photo {rel}: {exc})")
    return rel.replace(os.sep, "/")


def get_or_create_usuario(db, nombre: str, email: str, rol: str) -> tuple[Usuario, bool]:
    existente = db.query(Usuario).filter(Usuario.email == email).first()
    if existente is not None:
        return existente, False
    usuario = Usuario(
        nombre=nombre,
        email=email,
        password_hash=hash_password(DEMO_PASSWORD),
        rol=rol,
    )
    db.add(usuario)
    db.flush()
    return usuario, True


def get_or_create_cliente(db, nombre: str) -> tuple[Cliente, bool]:
    existente = db.query(Cliente).filter(Cliente.nombre == nombre).first()
    if existente is not None:
        return existente, False
    cliente = Cliente(nombre=nombre)
    db.add(cliente)
    db.flush()
    return cliente, True


def crear_horarios(db, tecnico: Usuario) -> None:
    """Monday(0)–Friday(4), 8:00–17:00."""
    for dia in range(5):
        db.add(
            Horario(
                tecnico_id=tecnico.id,
                dia_semana=dia,
                hora_inicio=time(8, 0),
                hora_fin=time(17, 0),
                activo=True,
            )
        )


def _entrada_local(fecha: date) -> time:
    """~70% on time (7:50–8:05), ~30% late (8:20–9:00)."""
    if random.random() < 0.70:
        minuto_total = random.randint(7 * 60 + 50, 8 * 60 + 5)
    else:
        minuto_total = random.randint(8 * 60 + 20, 9 * 60)
    h, m = divmod(minuto_total, 60)
    return time(h, m)


def _salida_local(fecha: date) -> time | None:
    """55% normal (~17:00-17:15), 20% early (15:30-16:00), 15% overtime
    (17:30-19:00), 10% no checkout at all (caller handles that case)."""
    roll = random.random()
    if roll < 0.55:
        minuto_total = random.randint(17 * 60, 17 * 60 + 15)
    elif roll < 0.75:
        minuto_total = random.randint(15 * 60 + 30, 16 * 60)
    else:
        minuto_total = random.randint(17 * 60 + 30, 19 * 60)
    h, m = divmod(minuto_total, 60)
    return time(h, m)


def crear_jornadas(db, tecnico: Usuario, dias_habiles: list[date]) -> int:
    creadas = 0
    for fecha in dias_habiles:
        if random.random() < 0.08:  # occasional missing day — no record at all
            continue

        entrada_local_dt = datetime.combine(fecha, _entrada_local(fecha), tzinfo=TZ)
        entrada_utc = entrada_local_dt.astimezone(timezone.utc)

        sin_salida = random.random() < 0.10
        salida_utc = None
        horas_trabajadas = None
        salida_foto = None
        salida_lat = salida_lng = salida_precision = None
        estatus = "sin_salida"

        if not sin_salida:
            salida_local_dt = datetime.combine(fecha, _salida_local(fecha), tzinfo=TZ)
            salida_utc = salida_local_dt.astimezone(timezone.utc)
            horas_trabajadas = round((salida_utc - entrada_utc).total_seconds() / 3600, 2)
            salida_foto = write_placeholder_photo(fecha, "out")
            salida_lat = jitter(BASE_LAT)
            salida_lng = jitter(BASE_LNG)
            salida_precision = round(random.uniform(4, 25), 1)
            estatus = "completa"

        db.add(
            Jornada(
                tecnico_id=tecnico.id,
                fecha=fecha,
                entrada_hora=entrada_utc,
                entrada_lat=jitter(BASE_LAT),
                entrada_lng=jitter(BASE_LNG),
                entrada_precision_m=round(random.uniform(4, 25), 1),
                entrada_foto_url=write_placeholder_photo(fecha, "in"),
                salida_hora=salida_utc,
                salida_lat=salida_lat,
                salida_lng=salida_lng,
                salida_precision_m=salida_precision,
                salida_foto_url=salida_foto,
                horas_trabajadas=horas_trabajadas,
                estatus=estatus,
            )
        )
        creadas += 1
    return creadas


def crear_servicios(
    db, tecnico: Usuario, admin_id, clientes: list[Cliente], dias_totales: list[date]
) -> int:
    """~2-3 services per week, scattered across the full 30-day window
    (weekends included — servicios aren't tied to the attendance calendar)."""
    creados = 0
    dias_totales = sorted(dias_totales)
    for inicio in range(0, len(dias_totales), 7):
        semana = dias_totales[inicio : inicio + 7]
        if not semana:
            continue
        for _ in range(random.randint(2, 3)):
            fecha = random.choice(semana)
            cliente = random.choice(clientes)
            estatus = random.choices(
                ["completado", "pendiente", "cancelado"], weights=[55, 30, 15]
            )[0]
            hora = (
                time(random.randint(8, 16), random.choice([0, 15, 30, 45]))
                if random.random() < 0.7
                else None
            )
            notas = None
            if estatus == "cancelado":
                notas = random.choice(["Cliente reprogramó", "Acceso no disponible en sitio"])
            db.add(
                Servicio(
                    cliente_id=cliente.id,
                    tecnico_id=tecnico.id,
                    asignado_por=admin_id,
                    fecha=fecha,
                    hora=hora,
                    descripcion=f"{random.choice(DESCRIPCIONES)} — {cliente.nombre}",
                    estatus=estatus,
                    notas=notas,
                )
            )
            creados += 1
    return creados


def main():
    db = SessionLocal()
    resumen_usuarios = []  # (nombre, email, rol, creado: bool)
    resumen_tecnicos = []  # (nombre, jornadas_creadas, servicios_creados)

    try:
        hoy = datetime.now(TZ).date()
        dias_totales = [hoy - timedelta(days=i) for i in range(DIAS_HISTORIA)]
        dias_habiles = [d for d in dias_totales if d.weekday() < 5]

        clientes = []
        clientes_creados = 0
        for nombre in CLIENTES:
            cliente, creado = get_or_create_cliente(db, nombre)
            clientes.append(cliente)
            clientes_creados += creado

        admin_user = None
        for u in USUARIOS:
            usuario, creado = get_or_create_usuario(db, u["nombre"], u["email"], u["rol"])
            resumen_usuarios.append((u["nombre"], u["email"], u["rol"], creado))
            if u["rol"] == "admin":
                admin_user = usuario

            if u["rol"] == "tecnico":
                if creado:
                    crear_horarios(db, usuario)
                    n_jornadas = crear_jornadas(db, usuario, dias_habiles)
                    n_servicios = crear_servicios(
                        db, usuario, admin_user.id, clientes, dias_totales
                    )
                    resumen_tecnicos.append((u["nombre"], n_jornadas, n_servicios))
                else:
                    resumen_tecnicos.append((u["nombre"], 0, 0))

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()

    ancho = 72
    print("=" * ancho)
    print("DEMO SEED SUMMARY")
    print("=" * ancho)
    print(f"Clientes: {clientes_creados} created, {len(CLIENTES) - clientes_creados} already existed")
    print()
    print("Credentials:")
    for nombre, email, rol, creado in resumen_usuarios:
        estado = "created" if creado else "already existed (password unchanged)"
        pwd = DEMO_PASSWORD if creado else "(unknown — user pre-existed)"
        print(f"  - [{rol:8s}] {nombre:16s} {email:20s} password={pwd:32s} [{estado}]")
    print()
    print(f"{'Técnico':<16s} {'Jornadas inserted':>18s} {'Servicios inserted':>20s}")
    for nombre, n_jornadas, n_servicios in resumen_tecnicos:
        nota = "" if (n_jornadas or n_servicios) else "  (skipped — user already existed)"
        print(f"  {nombre:<16s} {n_jornadas:>18d} {n_servicios:>20d}{nota}")
    print("=" * ancho)


if __name__ == "__main__":
    main()
