import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";
import { formatFecha } from "../utils/formato";

const TIPO_LABELS = {
  falta: "Falta justificada",
  vacaciones: "Vacaciones",
  permiso_con_goce: "Permiso con goce",
  permiso_sin_goce: "Permiso sin goce",
  incapacidad: "Incapacidad",
};

const ESTATUS_STYLES = {
  pendiente: "bg-accent/10 text-amber-700",
  aprobada: "bg-secondary/10 text-secondary",
  rechazada: "bg-danger/10 text-danger",
};

const ESTATUS_LABELS = {
  pendiente: "Pendiente",
  aprobada: "Aprobada",
  rechazada: "Rechazada",
};

export default function MisPermisos() {
  const [permisos, setPermisos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get("/jornadas/ausencias")
      .then((res) => setPermisos(res.data))
      .catch(() => setError("No se pudo cargar tus solicitudes."))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-ink">Mis permisos</h1>
          <p className="text-ink-muted text-sm">Historial de tus solicitudes de permiso</p>
        </div>
      </div>

      <Link
        to="/solicitar-permiso"
        className="block w-full text-center rounded-lg bg-primary text-primary-fg font-medium py-3.5 text-base hover:opacity-90 transition-opacity"
      >
        Nueva solicitud
      </Link>

      {loading && <p className="text-ink-muted text-center py-8">Cargando…</p>}
      {error && <p className="text-danger text-center py-8">{error}</p>}

      {!loading && !error && permisos.length === 0 && (
        <p className="text-ink-muted text-center py-8">No has solicitado ningún permiso todavía.</p>
      )}

      <div className="space-y-3">
        {permisos.map((p) => (
          <div key={p.id} className="rounded-lg border border-border bg-surface shadow-card p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-ink">{TIPO_LABELS[p.tipo] || p.tipo}</p>
                <p className="text-sm text-ink-muted">{formatFecha(p.fecha)}</p>
              </div>
              <span
                className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                  ESTATUS_STYLES[p.estatus] || "bg-slate-200 text-slate-700"
                }`}
              >
                {ESTATUS_LABELS[p.estatus] || p.estatus}
              </span>
            </div>
            {p.notas && <p className="mt-2 text-sm text-ink-muted">"{p.notas}"</p>}
            {p.respuesta_notas && (
              <p className="mt-2 text-sm text-ink border-t border-border pt-2">
                Respuesta: {p.respuesta_notas}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
