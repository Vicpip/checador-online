import { XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { AUSENCIA_LABELS } from "./AusenciasCalendario";

/**
 * Registers one or more ausencia rows (one per day) for a técnico. A date
 * range is only offered for "vacaciones" — the backend stores one row per
 * (tecnico_id, fecha), so a multi-day request is submitted as one POST per
 * day in the range (see Calendario.jsx::handleSaveAusencia).
 */
export default function AusenciaModal({ tecnicos, workerLabel, onSave, onClose }) {
  const [form, setForm] = useState({
    tecnico_id: tecnicos[0]?.id || "",
    tipo: "vacaciones",
    fecha: "",
    fechaFin: "",
    notas: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo registrar la ausencia.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="bg-surface rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-ink">Registrar ausencia</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-muted cursor-pointer" aria-label="Cerrar">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">{workerLabel}</label>
            <select
              required
              value={form.tecnico_id}
              onChange={(e) => setForm((f) => ({ ...f, tecnico_id: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
            >
              {tecnicos.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Tipo</label>
            <select
              value={form.tipo}
              onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value, fechaFin: "" }))}
              className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
            >
              {Object.entries(AUSENCIA_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">
                {form.tipo === "vacaciones" ? "Desde" : "Fecha"}
              </label>
              <input
                type="date"
                required
                value={form.fecha}
                onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
              />
            </div>
            {form.tipo === "vacaciones" && (
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Hasta (opcional)</label>
                <input
                  type="date"
                  min={form.fecha || undefined}
                  value={form.fechaFin}
                  onChange={(e) => setForm((f) => ({ ...f, fechaFin: e.target.value }))}
                  className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
                />
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Notas (opcional)</label>
            <textarea
              rows={2}
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-muted transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary text-primary-fg font-medium px-4 py-2.5 text-sm hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
