import { CheckCircleIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/client";

const TIPO_LABELS = {
  vacaciones: "Vacaciones",
  permiso_con_goce: "Permiso con goce",
  permiso_sin_goce: "Permiso sin goce",
  incapacidad: "Incapacidad",
};

const FORM_INICIAL = { tipo: "vacaciones", fechaInicio: "", fechaFin: "", notas: "" };

function rangoFechas(fechaInicio, fechaFin) {
  const fechas = [];
  for (
    let d = new Date(`${fechaInicio}T00:00:00`);
    d <= new Date(`${fechaFin}T00:00:00`);
    d.setDate(d.getDate() + 1)
  ) {
    fechas.push(d.toISOString().slice(0, 10));
  }
  return fechas;
}

export default function SolicitarPermiso() {
  const [form, setForm] = useState(FORM_INICIAL);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [enviado, setEnviado] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");

    if (!form.fechaInicio || !form.fechaFin) {
      setError("Selecciona la fecha de inicio y de fin.");
      return;
    }
    if (form.fechaFin < form.fechaInicio) {
      setError("La fecha de fin no puede ser anterior a la de inicio.");
      return;
    }

    setEnviando(true);
    try {
      const fechas = rangoFechas(form.fechaInicio, form.fechaFin);
      for (const fecha of fechas) {
        await api.post("/jornadas/ausencias", {
          fecha,
          tipo: form.tipo,
          notas: form.notas || null,
        });
      }
      setForm(FORM_INICIAL);
      setEnviado(true);
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo enviar la solicitud. Intenta de nuevo.");
    } finally {
      setEnviando(false);
    }
  }

  if (enviado) {
    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-ink">Solicitar permiso</h1>
        </div>
        <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-surface shadow-card p-8 text-center">
          <CheckCircleIcon className="h-12 w-12 text-secondary" aria-hidden="true" />
          <p className="font-medium text-ink">Solicitud enviada</p>
          <p className="text-sm text-ink-muted">
            Tu solicitud de permiso quedó registrada. Un administrador la revisará.
          </p>
          <div className="flex gap-3 mt-2">
            <button
              onClick={() => setEnviado(false)}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-muted transition-colors cursor-pointer"
            >
              Enviar otra solicitud
            </button>
            <Link
              to="/mis-permisos"
              className="rounded-lg bg-primary text-primary-fg px-4 py-2.5 text-sm font-medium hover:opacity-90 transition-opacity"
            >
              Ver mis permisos
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Solicitar permiso</h1>
        <p className="text-ink-muted text-sm">Registra una ausencia o solicitud de permiso</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-border bg-surface shadow-card p-4">
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Tipo de permiso</label>
          <select
            value={form.tipo}
            onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
          >
            {Object.entries(TIPO_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Fecha inicio</label>
            <input
              type="date"
              required
              value={form.fechaInicio}
              onChange={(e) => setForm((f) => ({ ...f, fechaInicio: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Fecha fin</label>
            <input
              type="date"
              required
              min={form.fechaInicio || undefined}
              value={form.fechaFin}
              onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Notas (opcional)</label>
          <textarea
            rows={3}
            value={form.notas}
            onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
          />
        </div>

        {error && (
          <p role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2.5">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={enviando}
          className="w-full rounded-lg bg-primary text-primary-fg font-medium py-3.5 text-base hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
        >
          {enviando ? "Enviando…" : "Enviar solicitud"}
        </button>
      </form>
    </div>
  );
}
