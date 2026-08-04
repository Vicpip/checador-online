import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import api from "../api/client";
import { formatFecha, formatHora } from "../utils/formato";

const ESTATUS_STYLES = {
  activa: "bg-accent/10 text-amber-700",
  completa: "bg-secondary/10 text-secondary",
  sin_salida: "bg-danger/10 text-danger",
};

const ESTATUS_LABELS = {
  activa: "En curso",
  completa: "Completa",
  sin_salida: "Sin salida",
};

function primerDiaMes(year, month) {
  return `${year}-${String(month + 1).padStart(2, "0")}-01`;
}

function ultimoDiaMes(year, month) {
  const ultimo = new Date(year, month + 1, 0).getDate();
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(ultimo).padStart(2, "0")}`;
}

export default function MisJornadas() {
  const hoy = new Date();
  const [cursor, setCursor] = useState({ year: hoy.getFullYear(), month: hoy.getMonth() });
  const [jornadas, setJornadas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .get("/jornadas/historial", {
        params: {
          fecha_inicio: primerDiaMes(cursor.year, cursor.month),
          fecha_fin: ultimoDiaMes(cursor.year, cursor.month),
        },
      })
      .then((res) => setJornadas(res.data))
      .catch(() => setError("No se pudo cargar tu historial."))
      .finally(() => setLoading(false));
  }, [cursor]);

  function cambiarMes(delta) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  const tituloMes = new Date(cursor.year, cursor.month, 1).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Mis jornadas</h1>
        <p className="text-ink-muted text-sm">Historial de entradas y salidas</p>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5">
        <button
          onClick={() => cambiarMes(-1)}
          className="p-1.5 rounded-lg hover:bg-surface-muted text-ink-muted cursor-pointer"
          aria-label="Mes anterior"
        >
          <ChevronLeftIcon className="h-5 w-5" />
        </button>
        <span className="font-medium text-ink capitalize">{tituloMes}</span>
        <button
          onClick={() => cambiarMes(1)}
          className="p-1.5 rounded-lg hover:bg-surface-muted text-ink-muted cursor-pointer"
          aria-label="Mes siguiente"
        >
          <ChevronRightIcon className="h-5 w-5" />
        </button>
      </div>

      {loading && <p className="text-ink-muted text-center py-8">Cargando…</p>}
      {error && <p className="text-danger text-center py-8">{error}</p>}

      {!loading && !error && jornadas.length === 0 && (
        <p className="text-ink-muted text-center py-8">No hay jornadas registradas este mes.</p>
      )}

      <div className="space-y-3">
        {jornadas.map((j) => (
          <div key={j.id} className="rounded-lg border border-border bg-surface shadow-card p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="font-medium text-ink">{formatFecha(j.fecha)}</p>
              <span
                className={`shrink-0 inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                  ESTATUS_STYLES[j.estatus] || "bg-slate-200 text-slate-700"
                }`}
              >
                {ESTATUS_LABELS[j.estatus] || j.estatus}
              </span>
            </div>
            <p className="mt-2 text-sm text-ink-muted">
              Entrada: {formatHora(j.entrada_hora)}
              {j.salida_hora && ` · Salida: ${formatHora(j.salida_hora)}`}
            </p>
            {j.horas_trabajadas != null && (
              <p className="mt-1 text-sm text-ink">{j.horas_trabajadas}h trabajadas</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
