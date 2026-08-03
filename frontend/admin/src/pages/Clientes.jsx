import { useEffect, useState } from "react";
import api from "../api/client";

const EMPTY = { nombre: "", direccion: "", telefono: "" };

export default function Clientes() {
  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function load() {
    api.get("/admin/clientes").then((res) => setClientes(res.data));
  }

  useEffect(load, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      await api.post("/admin/clientes", form);
      setForm(EMPTY);
      load();
    } catch {
      setError("No se pudo crear el cliente.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Clientes</h1>
        <p className="text-ink-muted mt-1">Sitios / cuentas que reciben servicio</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="rounded-lg border border-border bg-surface shadow-card p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end"
      >
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Nombre</label>
          <input
            required
            value={form.nombre}
            onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Dirección</label>
          <input
            value={form.direccion}
            onChange={(e) => setForm((f) => ({ ...f, direccion: e.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-ink mb-1.5">Teléfono</label>
          <input
            value={form.telefono}
            onChange={(e) => setForm((f) => ({ ...f, telefono: e.target.value }))}
            className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-primary text-primary-fg font-medium px-4 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer"
        >
          {saving ? "Creando…" : "Crear cliente"}
        </button>
        {error && (
          <p role="alert" className="sm:col-span-2 lg:col-span-4 text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
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
                <th className="text-left font-medium px-5 py-3">Dirección</th>
                <th className="text-left font-medium px-5 py-3">Teléfono</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {clientes.map((c) => (
                <tr key={c.id}>
                  <td className="px-5 py-3 text-ink">{c.nombre}</td>
                  <td className="px-5 py-3 text-ink-muted">{c.direccion || "—"}</td>
                  <td className="px-5 py-3 text-ink-muted">{c.telefono || "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
