"""
Punctuality logic.

Configurable per deployment via the `config` DB table's hora_limite_entrada
(admin-editable in Configuración), falling back to HORA_LIMITE_ENTRADA (env,
default 08:00) when unset. Extend here for grace periods, shift policies, or
per-worker schedules — keep that kind of business-rule logic out of the
routers.

`entrada_hora` is stored as a UTC-aware datetime (see models.py); punctuality
is a business-timezone concept, so it's converted to `settings.business_timezone`
before comparing against the wall-clock cutoff.
"""
from datetime import date, datetime, time
from zoneinfo import ZoneInfo

from settings import get_settings


def _zona_negocio() -> ZoneInfo:
    return ZoneInfo(get_settings().business_timezone)


def hora_limite(config_hora_limite: time | None = None) -> time:
    if config_hora_limite is not None:
        return config_hora_limite
    settings = get_settings()
    hh, mm = settings.hora_limite_entrada.split(":")
    return time(hour=int(hh), minute=int(mm))


def es_puntual(entrada_hora: datetime, limite: time | None = None) -> bool:
    hora_local = entrada_hora.astimezone(_zona_negocio()).time()
    return hora_local <= hora_limite(limite)


def calcular_puntualidad_pct(
    entradas: list[datetime], config_hora_limite: time | None = None
) -> float:
    if not entradas:
        return 0.0
    limite = hora_limite(config_hora_limite)
    puntuales = sum(1 for e in entradas if es_puntual(e, limite))
    return round(puntuales / len(entradas) * 100, 2)


def _horas_entre(inicio: time, fin: time) -> float:
    """Hours between two wall-clock times on the same day (fin assumed after inicio)."""
    segundos = (
        datetime.combine(date.min, fin) - datetime.combine(date.min, inicio)
    ).total_seconds()
    return round(max(segundos, 0) / 3600, 2)


class JornadaAnalisisResultado:
    def __init__(
        self,
        dia_semana: int,
        horas_esperadas: float | None,
        horas_extra: float | None,
        entro_antes: bool | None,
        salio_despues: bool | None,
        salio_antes: bool | None,
        puntual: bool,
    ):
        self.dia_semana = dia_semana
        self.horas_esperadas = horas_esperadas
        self.horas_extra = horas_extra
        self.entro_antes = entro_antes
        self.salio_despues = salio_despues
        self.salio_antes = salio_antes
        self.puntual = puntual


def analizar_jornada(
    entrada_hora: datetime,
    salida_hora: datetime | None,
    horas_trabajadas: float | None,
    fecha: date,
    horario: "Horario | None",  # noqa: F821 — see models.Horario, kept as a string to avoid a hard import
    hora_limite_cfg: time | None,
) -> JornadaAnalisisResultado:
    """
    Compare a jornada's actual check-in/out against the técnico's expected
    schedule for that day of week (`horario`, or None if none is configured /
    that day isn't a workday). `dia_semana` follows `date.weekday()`
    (0=Lunes ... 6=Domingo), matching `horarios.dia_semana` — see models.py.
    """
    zona = _zona_negocio()
    entrada_local = entrada_hora.astimezone(zona).time()
    salida_local = salida_hora.astimezone(zona).time() if salida_hora else None

    horas_esperadas = None
    horas_extra = None
    entro_antes = None
    salio_despues = None
    salio_antes = None

    if horario is not None and horario.activo:
        horas_esperadas = _horas_entre(horario.hora_inicio, horario.hora_fin)
        entro_antes = entrada_local < horario.hora_inicio
        if salida_local is not None:
            salio_despues = salida_local > horario.hora_fin
            salio_antes = salida_local < horario.hora_fin
        if horas_trabajadas is not None:
            horas_extra = round(max(0.0, horas_trabajadas - horas_esperadas), 2)

    return JornadaAnalisisResultado(
        dia_semana=fecha.weekday(),
        horas_esperadas=horas_esperadas,
        horas_extra=horas_extra,
        entro_antes=entro_antes,
        salio_despues=salio_despues,
        salio_antes=salio_antes,
        puntual=es_puntual(entrada_hora, hora_limite_cfg),
    )
