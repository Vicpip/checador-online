import { CheckCircleIcon, ClockIcon } from "@heroicons/react/24/solid";
import { formatHora } from "../utils/formato";

export default function EstadoJornada({ jornada }) {
  if (!jornada) {
    return (
      <div className="rounded-lg border border-border bg-surface p-5 flex items-center gap-3">
        <ClockIcon className="h-8 w-8 text-ink-muted" aria-hidden="true" />
        <div>
          <p className="font-medium text-ink">Aún no registras entrada hoy</p>
          <p className="text-sm text-ink-muted">Toma tu foto de entrada para comenzar tu jornada.</p>
        </div>
      </div>
    );
  }

  const enCurso = jornada.estatus === "activa";

  return (
    <div
      className={`rounded-lg border p-5 flex items-center gap-3 ${
        enCurso ? "border-accent/40 bg-accent/10" : "border-secondary/40 bg-secondary/10"
      }`}
    >
      {enCurso ? (
        <ClockIcon className="h-8 w-8 text-accent" aria-hidden="true" />
      ) : (
        <CheckCircleIcon className="h-8 w-8 text-secondary" aria-hidden="true" />
      )}
      <div>
        <p className="font-medium text-ink">
          {enCurso ? "Jornada en curso" : "Jornada completada"}
        </p>
        <p className="text-sm text-ink-muted">
          Entrada: {formatHora(jornada.entrada_hora)}
          {jornada.salida_hora && ` · Salida: ${formatHora(jornada.salida_hora)}`}
          {jornada.horas_trabajadas != null && ` · ${jornada.horas_trabajadas}h trabajadas`}
        </p>
      </div>
    </div>
  );
}
