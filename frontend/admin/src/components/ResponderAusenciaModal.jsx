import { XMarkIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

/**
 * Confirms approving/rejecting a técnico's pending ausencia request
 * (PATCH /admin/ausencias/{id}/responder). `estatus` ("aprobada" | "rechazada")
 * is fixed by which button on the "Solicitudes pendientes" row opened this
 * modal — the admin only adds an optional note here, not a status choice.
 */
export default function ResponderAusenciaModal({ ausencia, estatus, tecnicoNombre, tipoLabel, onSave, onClose }) {
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const esAprobar = estatus === "aprobada";

  async function handleConfirm() {
    setSaving(true);
    setError("");
    try {
      await onSave(ausencia.id, { estatus, respuesta_notas: notas || null });
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo guardar la respuesta.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="bg-surface rounded-lg shadow-xl max-w-sm w-full">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-ink">{esAprobar ? "Aprobar solicitud" : "Rechazar solicitud"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-muted cursor-pointer" aria-label="Cerrar">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <p className="text-sm text-ink">
            {tecnicoNombre} · {tipoLabel}
          </p>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Nota (opcional)</label>
            <textarea
              rows={2}
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
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
              type="button"
              onClick={handleConfirm}
              disabled={saving}
              className={`rounded-lg font-medium px-4 py-2.5 text-sm transition-opacity disabled:opacity-60 cursor-pointer ${
                esAprobar
                  ? "bg-secondary text-secondary-fg hover:opacity-90"
                  : "bg-danger text-white hover:opacity-90"
              }`}
            >
              {saving ? "Guardando…" : esAprobar ? "Aprobar" : "Rechazar"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
