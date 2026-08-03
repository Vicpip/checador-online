import { useEffect, useState } from "react";
import api from "../api/client";
import { useConfig } from "../context/ConfigContext";
import EditarPerfilModal from "../components/EditarPerfilModal";

const EMPTY = { nombre: "", email: "", password: "", rol: "tecnico" };

export default function Usuarios() {
  const { config } = useConfig();
  const [usuarios, setUsuarios] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editando, setEditando] = useState(null);

  function load() {
    api.get("/admin/usuarios").then((res) => setUsuarios(res.data));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/admin/usuarios", form);
      setForm(EMPTY);
      load();
    } catch (err) {
      setError(err.response?.data?.detail || "No se pudo crear el usuario.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleActivo(u) {
    await api.patch(`/admin/usuarios/${u.id}`, { activo: !u.activo });
    load();
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Usuarios</h1>
        <p className="text-ink-muted mt-1">
          {config.worker_role_label}s y {config.admin_role_label.toLowerCase()}es del sistema
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-border bg-surface shadow-card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 items-end"
      >
        <div className="lg:col-span-1">
          <label className="block text-sm font-medium text-ink mb-1.5">Nombre</label>
          <input
            required
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Correo</label>
          <input
            type="email"
            required
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Contraseña</label>
          <input
            type="password"
            required
            minLength={8}
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Rol</label>
          <select
            value={form.rol}
            onChange={(e) => setForm((f) => ({ ...f, rol: e.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
          >
            <option value="tecnico">{config.worker_role_label}</option>
            <option value="admin">{config.admin_role_label}</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary text-primary-fg font-medium px-4 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer"
        >
          {saving ? "Creando…" : "Crear usuario"}
        </button>
        {error && (
          <p role="alert" className="sm:col-span-2 lg:col-span-5 text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
      </form>

      <div className="rounded-lg border border-border bg-surface shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-surface-muted text-ink-muted">
              <tr>
                <th className="text-left font-medium px-5 py-3">Nombre</th>
                <th className="text-left font-medium px-5 py-3">Correo</th>
                <th className="text-left font-medium px-5 py-3">Rol</th>
                <th className="text-left font-medium px-5 py-3">Estado</th>
                <th className="text-left font-medium px-5 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {usuarios.map((u) => (
                <tr key={u.id}>
                  <td className="px-5 py-3 text-ink">{u.nombre}</td>
                  <td className="px-5 py-3 text-ink-muted">{u.email}</td>
                  <td className="px-5 py-3 text-ink-muted">
                    {u.rol === "admin" ? config.admin_role_label : config.worker_role_label}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
                        u.activo ? "bg-secondary/10 text-secondary" : "bg-slate-200 text-slate-600"
                      }`}
                    >
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setEditando(u)}
                        className="text-sm text-primary hover:underline cursor-pointer"
                      >
                        Editar perfil
                      </button>
                      <button
                        onClick={() => toggleActivo(u)}
                        className="text-sm text-primary hover:underline cursor-pointer"
                      >
                        {u.activo ? "Desactivar" : "Activar"}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editando && (
        <EditarPerfilModal usuario={editando} onClose={() => setEditando(null)} onSaved={load} />
      )}
    </div>
  );
}
