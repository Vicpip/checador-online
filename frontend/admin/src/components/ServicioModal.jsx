import { XMarkIcon, TrashIcon } from "@heroicons/react/24/outline";
import { useState } from "react";

const ESTATUS_OPTS = ["pendiente", "en_curso", "completado", "cancelado"];

export default function ServicioModal({
  initial,
  clientes,
  tecnicos,
  workerLabel,
  onSave,
  onDelete,
  onClose,
}) {
  const isEdit = Boolean(initial?.id);
  const [form, setForm] = useState({
    cliente_id: initial?.cliente_id || clientes[0]?.id || "",
    tecnico_id: initial?.tecnico_id || tecnicos[0]?.id || "",
    fecha: initial?.fecha || "",
    hora: initial?.hora ? initial.hora.slice(0, 5) : "",
    descripcion: initial?.descripcion || "",
    notas: initial?.notas || "",
    estatus: initial?.estatus || "pendiente",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await onSave({ ...form, hora: form.hora || null });
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo guardar el servicio.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="bg-surface rounded-lg shadow-xl max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="font-semibold text-ink">{isEdit ? "Editar servicio" : "Nuevo servicio"}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-muted cursor-pointer" aria-label="Cerrar">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Cliente</label>
            <select
              required
              value={form.cliente_id}
              onChange={(e) => setForm((f) => ({ ...f, cliente_id: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
            >
              {clientes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nombre}
                </option>
              ))}
            </select>
          </div>

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

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Fecha</label>
              <input
                type="date"
                required
                value={form.fecha}
                onChange={(e) => setForm((f) => ({ ...f, fecha: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Hora (opcional)</label>
              <input
                type="time"
                value={form.hora}
                onChange={(e) => setForm((f) => ({ ...f, hora: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Descripción</label>
            <input
              type="text"
              required
              maxLength={300}
              value={form.descripcion}
              onChange={(e) => setForm((f) => ({ ...f, descripcion: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
            />
          </div>

          {isEdit && (
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Estatus</label>
              <select
                value={form.estatus}
                onChange={(e) => setForm((f) => ({ ...f, estatus: e.target.value }))}
                className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
              >
                {ESTATUS_OPTS.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Notas (opcional)</label>
            <textarea
              rows={2}
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
              className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
            />
          </div>

          {error && <p role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex items-center justify-between gap-3 pt-2">
            {isEdit && onDelete ? (
              <button
                type="button"
                onClick={() => onDelete(initial.id)}
                className="flex items-center gap-1.5 text-sm text-danger hover:underline cursor-pointer"
              >
                <TrashIcon className="h-4 w-4" /> Eliminar
              </button>
            ) : (
              <span />
            )}
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-primary text-primary-fg font-medium px-4 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer"
            >
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
