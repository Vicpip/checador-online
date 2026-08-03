import { MapPinIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import api from "../api/client";
import { formatFecha, formatHoraSimple } from "../utils/formato";

const ESTATUS_STYLES = {
  pendiente: "bg-slate-200 text-slate-700",
  en_curso: "bg-accent/10 text-amber-700",
  completado: "bg-secondary/10 text-secondary",
  cancelado: "bg-danger/10 text-danger",
};

const ESTATUS_LABELS = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  completado: "Completado",
  cancelado: "Cancelado",
};

export default function MisServicios() {
  const [servicios, setServicios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/me/servicios")
      .then((res) => setServicios(res.data))
      .catch(() => setError("No se pudieron cargar tus servicios."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Mis servicios</h1>
        <p className="text-ink-muted text-sm">Asignaciones de esta semana</p>
      </div>

      {loading && <p className="text-ink-muted text-center py-8">Cargando…</p>}
      {error && <p className="text-danger text-center py-8">{error}</p>}

      {!loading && !error && servicios.length === 0 && (
        <p className="text-ink-muted text-center py-8">No tienes servicios asignados esta semana.</p>
      )}

      <div className="space-y-3">
        {servicios.map((s) => (
          <div key={s.id} className="rounded-lg border border-border bg-surface shadow-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-medium text-ink truncate">{s.cliente_nombre}</p>
                <p className="text-sm text-ink-muted">
                  {formatFecha(s.fecha)}
                  {s.hora && ` · ${formatHoraSimple(s.hora)}`}
                </p>
              </div>
              <span
                className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                  ESTATUS_STYLES[s.estatus] || "bg-slate-200 text-slate-700"
                }`}
              >
                {ESTATUS_LABELS[s.estatus] || s.estatus}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink">{s.descripcion}</p>
            {s.notas && <p className="mt-1 text-sm text-ink-muted">{s.notas}</p>}
          </div>
        ))}
      </div>

      <p className="flex items-center gap-1.5 text-xs text-ink-muted pt-2">
        <MapPinIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
        Esta pantalla es solo informativa — el registro de asistencia es independiente.
      </p>
    </div>
  );
}
