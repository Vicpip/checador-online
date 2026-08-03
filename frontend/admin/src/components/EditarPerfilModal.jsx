import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import api from "../api/client";

const DIAS = [
  { value: 0, label: "Lunes" },
  { value: 1, label: "Martes" },
  { value: 2, label: "Miércoles" },
  { value: 3, label: "Jueves" },
  { value: 4, label: "Viernes" },
  { value: 5, label: "Sábado" },
];

function horaCorta(hora) {
  return hora ? hora.slice(0, 5) : "";
}

function filaVacia(dia) {
  return { dia_semana: dia, hora_inicio: "08:00", hora_fin: "17:00", activo: false };
}

/** Edit a técnico's basic info + expected weekly schedule (Mon–Sat). */
export default function EditarPerfilModal({ usuario, onClose, onSaved }) {
  const [nombre, setNombre] = useState(usuario.nombre);
  const [email, setEmail] = useState(usuario.email);
  const [activo, setActivo] = useState(usuario.activo);
  const [horarios, setHorarios] = useState(DIAS.map((d) => filaVacia(d.value)));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    api
      .get(`/admin/usuarios/${usuario.id}/horarios`)
      .then((res) => {
        const porDia = Object.fromEntries(res.data.map((h) => [h.dia_semana, h]));
        setHorarios(
          DIAS.map((d) => {
            const h = porDia[d.value];
            return h
              ? {
                  dia_semana: h.dia_semana,
                  hora_inicio: horaCorta(h.hora_inicio),
                  hora_fin: horaCorta(h.hora_fin),
                  activo: h.activo,
                }
              : filaVacia(d.value);
          })
        );
      })
      .catch(() => setError("No se pudo cargar el horario."))
      .finally(() => setLoading(false));
  }, [usuario.id]);

  function actualizarFila(dia, cambios) {
    setHorarios((filas) => filas.map((f) => (f.dia_semana === dia ? { ...f, ...cambios } : f)));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.patch(`/admin/usuarios/${usuario.id}`, { nombre, email, activo });
      await api.put(`/admin/usuarios/${usuario.id}/horarios`, horarios);
      onSaved();
      onClose();
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo guardar el perfil.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="bg-surface rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-surface">
          <h3 className="font-semibold text-ink">Editar perfil</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-muted cursor-pointer" aria-label="Cerrar">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Nombre</label>
              <input
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink mb-1.5">Correo</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
              />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                id="activo"
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30 cursor-pointer"
              />
              <label htmlFor="activo" className="text-sm font-medium text-ink cursor-pointer">
                Usuario activo
              </label>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-ink mb-2">Horario semanal esperado</h4>
            {loading ? (
              <p className="text-sm text-ink-muted">Cargando…</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-surface-muted text-ink-muted">
                      <tr>
                        <th className="text-left font-medium px-3 py-2">Día laboral</th>
                        <th className="text-left font-medium px-3 py-2">Día</th>
                        <th className="text-left font-medium px-3 py-2">Entrada</th>
                        <th className="text-left font-medium px-3 py-2">Salida</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {DIAS.map((d) => {
                        const fila = horarios.find((f) => f.dia_semana === d.value);
                        return (
                          <tr key={d.value}>
                            <td className="px-3 py-2">
                              <input
                                type="checkbox"
                                checked={fila.activo}
                                onChange={(e) => actualizarFila(d.value, { activo: e.target.checked })}
                                className="h-4 w-4 rounded border-border text-primary focus:ring-primary/30 cursor-pointer"
                                aria-label={`${d.label} es día laboral`}
                              />
                            </td>
                            <td className="px-3 py-2 text-ink">{d.label}</td>
                            <td className="px-3 py-2">
                              <input
                                type="time"
                                value={fila.hora_inicio}
                                disabled={!fila.activo}
                                onChange={(e) => actualizarFila(d.value, { hora_inicio: e.target.value })}
                                className="rounded-lg border border-border px-2 py-1.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none disabled:opacity-50"
                              />
                            </td>
                            <td className="px-3 py-2">
                              <input
                                type="time"
                                value={fila.hora_fin}
                                disabled={!fila.activo}
                                onChange={(e) => actualizarFila(d.value, { hora_fin: e.target.value })}
                                className="rounded-lg border border-border px-2 py-1.5 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none disabled:opacity-50"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <p className="text-xs text-ink-muted mt-2">
              Se usa para comparar horas trabajadas vs. esperadas en Reportes. Domingo no se
              considera día laboral en este sistema.
            </p>
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
              disabled={saving || loading}
              className="rounded-lg bg-primary text-primary-fg font-medium px-4 py-2.5 text-sm hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer"
            >
              {saving ? "Guardando…" : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
