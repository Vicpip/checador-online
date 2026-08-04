import { XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import { formatHora } from "../utils/formato";

/** Edits entrada_hora/salida_hora (wall-clock, business timezone) for one jornada. */
export default function EditarJornadaModal({ jornada, onSave, onClose }) {
  const [entradaHora, setEntradaHora] = useState(formatHora(jornada.entrada_hora));
  const [salidaHora, setSalidaHora] = useState(
    jornada.salida_hora ? formatHora(jornada.salida_hora) : ""
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({
        entrada_hora: entradaHora,
        salida_hora: salidaHora || null,
      });
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo actualizar la jornada.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="bg-surface rounded-lg shadow-xl max-w-md w-full overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h3 className="font-semibold text-ink">Editar jornada</h3>
            <p className="text-xs text-ink-muted">{jornada.tecnico_nombre}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-muted cursor-pointer" aria-label="Cerrar">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Hora entrada</label>
              <input
                type="time"
                required
                value={entradaHora}
                onChange={(e) => setEntradaHora(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Hora salida</label>
              <input
                type="time"
                value={salidaHora}
                onChange={(e) => setSalidaHora(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
              />
            </div>
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
