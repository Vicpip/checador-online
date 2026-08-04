/**
 * Color-codes a jornada's actual-vs-expected hours: green = on time, yellow =
 * checked in/out early or late, red = missing checkout or worked fewer hours
 * than scheduled. See backend/utils/puntualidad.py::analizar_jornada for how
 * these fields (puntual, salio_antes, salio_despues, horas_esperadas) are computed.
 */
export function evaluar(jornada) {
  if (jornada.estatus === "sin_salida" || !jornada.salida_hora) {
    return { tono: "danger", texto: "Sin salida" };
  }
  if (
    jornada.horas_esperadas != null &&
    jornada.horas_trabajadas != null &&
    jornada.horas_trabajadas < jornada.horas_esperadas
  ) {
    return { tono: "danger", texto: "Jornada corta" };
  }
  if (!jornada.puntual) {
    return { tono: "warning", texto: "Llegó tarde" };
  }
  if (jornada.salio_antes) {
    return { tono: "warning", texto: "Salió antes" };
  }
  if (jornada.salio_despues) {
    return { tono: "warning", texto: "Salió tarde" };
  }
  return { tono: "success", texto: "A tiempo" };
}

const TONE_CLASSES = {
  success: "bg-secondary/10 text-secondary",
  warning: "bg-accent/10 text-amber-700",
  danger: "bg-danger/10 text-danger",
};

export default function EstadoJornadaBadge({ jornada }) {
  const { tono, texto } = evaluar(jornada);
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${TONE_CLASSES[tono]}`}>
      {texto}
    </span>
  );
}
