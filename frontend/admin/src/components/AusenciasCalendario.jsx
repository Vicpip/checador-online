import { ChevronLeftIcon, ChevronRightIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import api from "../api/client";
import { formatFecha, hoyISO } from "../utils/formato";

export const AUSENCIA_LABELS = {
  falta: "Falta justificada",
  vacaciones: "Vacaciones",
  permiso_con_goce: "Permiso con goce",
  permiso_sin_goce: "Permiso sin goce",
  incapacidad: "Incapacidad",
};

const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const COLOR_CLASSES = {
  green: "bg-secondary/15 text-secondary border-secondary/30 hover:bg-secondary/25",
  yellow: "bg-accent/15 text-amber-700 border-accent/30 hover:bg-accent/25",
  red: "bg-danger/15 text-danger border-danger/30 hover:bg-danger/25",
  blue: "bg-blue-100 text-blue-700 border-blue-300 hover:bg-blue-200",
  neutral: "bg-surface-muted text-ink-muted border-border hover:bg-border/60",
};

function isoDate(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Python `date.weekday()` convention (0=Lunes … 6=Domingo) — matches `horarios.dia_semana`. */
function pythonWeekday(year, month, day) {
  return (new Date(year, month, day).getDay() + 6) % 7;
}

function construirCeldas(year, month) {
  const totalDias = new Date(year, month + 1, 0).getDate();
  const primerDiaSemana = pythonWeekday(year, month, 1);
  const celdas = Array(primerDiaSemana).fill(null);
  for (let d = 1; d <= totalDias; d++) celdas.push(d);
  while (celdas.length % 7 !== 0) celdas.push(null);
  return celdas;
}

function FormularioAusencia({ fecha, tecnicoId, onClose, onSaved }) {
  const [tipo, setTipo] = useState("falta");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    setSaving(true);
    setError("");
    try {
      await api.post("/admin/ausencias", {
        tecnico_id: tecnicoId,
        fecha,
        tipo,
        notas: notas || null,
      });
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo registrar la ausencia.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-surface rounded-lg shadow-xl max-w-sm w-full p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-ink">Registrar ausencia — {formatFecha(fecha)}</h4>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-muted cursor-pointer"
            aria-label="Cerrar"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
        {/* Not a <form> — this renders nested inside EditarPerfilModal's outer <form>,
            and a real nested <form> is invalid HTML with unreliable submit semantics. */}
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Tipo</label>
            <select
              value={tipo}
              onChange={(e) => setTipo(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
            >
              {Object.entries(AUSENCIA_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Notas (opcional)</label>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="rounded-lg bg-primary text-primary-fg font-medium px-3 py-2 text-sm hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer"
            >
              {saving ? "Guardando…" : "Registrar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function DetalleAusencia({ ausencia, onClose, onDeleted }) {
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  async function handleDelete() {
    setDeleting(true);
    setError("");
    try {
      await api.delete(`/admin/ausencias/${ausencia.id}`);
      onDeleted();
      onClose();
    } catch {
      setError("No se pudo eliminar la ausencia.");
      setDeleting(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="bg-surface rounded-lg shadow-xl max-w-sm w-full p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="font-semibold text-ink">Ausencia — {formatFecha(ausencia.fecha)}</h4>
          <button
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-surface-muted cursor-pointer"
            aria-label="Cerrar"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm text-ink">
          <span className="font-medium">Tipo:</span>{" "}
          {AUSENCIA_LABELS[ausencia.tipo] || ausencia.tipo}
        </p>
        {ausencia.notas && <p className="text-sm text-ink-muted">{ausencia.notas}</p>}
        {error && (
          <p role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink hover:bg-surface-muted transition-colors cursor-pointer"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded-lg bg-danger text-white font-medium px-3 py-2 text-sm hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer"
          >
            {deleting ? "Eliminando…" : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Month calendar of a técnico's attendance: green = jornada completa, yellow =
 * jornada sin salida, red = falta injustificada (día laboral sin jornada ni
 * ausencia), blue = ausencia registrada, gray = no es día laboral o el día
 * aún no ocurre. Clicking a red/gray day with no record opens a form to
 * register an ausencia; clicking a blue day shows/deletes the existing one.
 * `horarios` (Mon–Sat rows, dia_semana 0-5, see EditarPerfilModal) decides
 * which weekdays count as workdays — Sunday is never one, same as elsewhere.
 */
export default function AusenciasCalendario({ tecnicoId, horarios }) {
  const hoy = hoyISO();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = hoy.split("-");
    return { year: Number(y), month: Number(m) - 1 };
  });
  const [jornadasPorFecha, setJornadasPorFecha] = useState({});
  const [ausenciasPorFecha, setAusenciasPorFecha] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formFecha, setFormFecha] = useState(null);
  const [detalleAusencia, setDetalleAusencia] = useState(null);

  function cargar() {
    const { year, month } = cursor;
    const fechaInicio = isoDate(year, month, 1);
    const fechaFin = isoDate(year, month, new Date(year, month + 1, 0).getDate());
    setLoading(true);
    setError("");
    Promise.all([
      api.get("/admin/jornadas", {
        params: {
          tecnico_id: tecnicoId,
          fecha_inicio: fechaInicio,
          fecha_fin: fechaFin,
          limit: 100,
        },
      }),
      api.get("/admin/ausencias", {
        params: { tecnico_id: tecnicoId, fecha_inicio: fechaInicio, fecha_fin: fechaFin },
      }),
    ])
      .then(([jRes, aRes]) => {
        setJornadasPorFecha(Object.fromEntries(jRes.data.items.map((j) => [j.fecha, j])));
        setAusenciasPorFecha(Object.fromEntries(aRes.data.map((a) => [a.fecha, a])));
      })
      .catch(() => setError("No se pudo cargar el calendario de asistencia."))
      .finally(() => setLoading(false));
  }

  useEffect(cargar, [cursor.year, cursor.month, tecnicoId]);

  function cambiarMes(delta) {
    setCursor(({ year, month }) => {
      const total = year * 12 + month + delta;
      return { year: Math.floor(total / 12), month: ((total % 12) + 12) % 12 };
    });
  }

  const horarioActivoPorDia = Object.fromEntries(
    (horarios || []).map((h) => [h.dia_semana, h.activo])
  );
  const celdas = construirCeldas(cursor.year, cursor.month);
  const tituloMes = new Date(cursor.year, cursor.month, 1).toLocaleDateString("es-MX", {
    month: "long",
    year: "numeric",
  });

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-semibold text-ink capitalize">{tituloMes}</h4>
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => cambiarMes(-1)}
            className="p-1.5 rounded-lg hover:bg-surface-muted cursor-pointer"
            aria-label="Mes anterior"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => cambiarMes(1)}
            className="p-1.5 rounded-lg hover:bg-surface-muted cursor-pointer"
            aria-label="Mes siguiente"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-danger mb-2">{error}</p>}

      <div className={`grid grid-cols-7 gap-1.5 ${loading ? "opacity-50" : ""}`}>
        {DIAS_SEMANA.map((d) => (
          <div key={d} className="text-center text-xs font-medium text-ink-muted py-1">
            {d}
          </div>
        ))}
        {celdas.map((dia, i) => {
          if (dia === null) return <div key={i} />;
          const iso = isoDate(cursor.year, cursor.month, dia);
          const diaSemana = pythonWeekday(cursor.year, cursor.month, dia);
          const jornada = jornadasPorFecha[iso];
          const ausencia = ausenciasPorFecha[iso];
          const horarioActivo = !!horarioActivoPorDia[diaSemana];
          const esFuturo = iso > hoy;

          let color = "neutral";
          let label = horarioActivo ? "Sin registro" : "No laboral";
          if (jornada) {
            color = jornada.salida_hora ? "green" : "yellow";
            label = jornada.salida_hora ? "Jornada completa" : "Jornada sin salida";
          } else if (ausencia) {
            color = "blue";
            label = AUSENCIA_LABELS[ausencia.tipo] || ausencia.tipo;
          } else if (horarioActivo && !esFuturo) {
            color = "red";
            label = "Falta injustificada";
          }

          const clickable = !jornada;
          return (
            <button
              key={iso}
              type="button"
              disabled={!clickable}
              onClick={() => {
                if (ausencia) setDetalleAusencia(ausencia);
                else setFormFecha(iso);
              }}
              title={`${formatFecha(iso)} — ${label}`}
              className={`aspect-square rounded-lg border text-sm font-medium flex items-center justify-center transition-colors ${
                COLOR_CLASSES[color]
              } ${clickable ? "cursor-pointer" : "cursor-default"}`}
            >
              {dia}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-secondary" />
          Completa
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-accent" />
          Sin salida
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger" />
          Falta injustificada
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-blue-500" />
          Ausencia registrada
        </span>
      </div>

      {formFecha && (
        <FormularioAusencia
          fecha={formFecha}
          tecnicoId={tecnicoId}
          onClose={() => setFormFecha(null)}
          onSaved={cargar}
        />
      )}
      {detalleAusencia && (
        <DetalleAusencia
          ausencia={detalleAusencia}
          onClose={() => setDetalleAusencia(null)}
          onDeleted={cargar}
        />
      )}
    </div>
  );
}
