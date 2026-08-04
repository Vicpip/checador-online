import { CameraIcon, MapPinIcon, PencilIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import api from "../api/client";
import Badge from "../components/Badge";
import PhotoModal from "../components/PhotoModal";
import MapaModal from "../components/MapaModal";
import EditarJornadaModal from "../components/EditarJornadaModal";
import { useConfig } from "../context/ConfigContext";
import { formatFecha, formatHora } from "../utils/formato";

export default function Jornadas() {
  const { config } = useConfig();
  const [tecnicos, setTecnicos] = useState([]);
  const [filtros, setFiltros] = useState({ tecnico_id: "", fecha_inicio: "", fecha_fin: "" });
  const [page, setPage] = useState(1);
  const [data, setData] = useState({ items: [], total: 0, limit: 20 });
  const [loading, setLoading] = useState(true);
  const [foto, setFoto] = useState(null); // { path, title }
  const [mapaJornada, setMapaJornada] = useState(null);
  const [editJornada, setEditJornada] = useState(null);

  useEffect(() => {
    api.get("/admin/tecnicos").then((res) => setTecnicos(res.data));
  }, []);

  function cargarJornadas() {
    setLoading(true);
    const params = { page, limit: 20 };
    if (filtros.tecnico_id) params.tecnico_id = filtros.tecnico_id;
    if (filtros.fecha_inicio) params.fecha_inicio = filtros.fecha_inicio;
    if (filtros.fecha_fin) params.fecha_fin = filtros.fecha_fin;
    return api
      .get("/admin/jornadas", { params })
      .then((res) => setData(res.data))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    cargarJornadas();
  }, [filtros, page]);

  async function handleGuardarJornada(cambios) {
    await api.patch(`/admin/jornadas/${editJornada.id}`, cambios);
    await cargarJornadas();
  }

  const totalPages = Math.max(1, Math.ceil(data.total / data.limit));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Jornadas</h1>
        <p className="text-ink-muted mt-1">Historial de check-in / check-out</p>
      </div>

      <div className="rounded-lg border border-border bg-surface shadow-card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">{config.worker_role_label}</label>
          <select
            value={filtros.tecnico_id}
            onChange={(e) => {
              setPage(1);
              setFiltros((f) => ({ ...f, tecnico_id: e.target.value }));
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
          >
            <option value="">Todos</option>
            {tecnicos.map((t) => (
              <option key={t.id} value={t.id}>
                {t.nombre}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Desde</label>
          <input
            type="date"
            value={filtros.fecha_inicio}
            onChange={(e) => {
              setPage(1);
              setFiltros((f) => ({ ...f, fecha_inicio: e.target.value }));
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Hasta</label>
          <input
            type="date"
            value={filtros.fecha_fin}
            onChange={(e) => {
              setPage(1);
              setFiltros((f) => ({ ...f, fecha_fin: e.target.value }));
            }}
            className="rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
          />
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface shadow-card overflow-hidden">
        {loading ? (
          <p className="p-5 text-ink-muted">Cargando…</p>
        ) : data.items.length === 0 ? (
          <p className="p-5 text-ink-muted">No hay jornadas para estos filtros.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-ink-muted">
                <tr>
                  <th className="text-left font-medium px-5 py-3">{config.worker_role_label}</th>
                  <th className="text-left font-medium px-5 py-3">Fecha</th>
                  <th className="text-left font-medium px-5 py-3">Entrada</th>
                  <th className="text-left font-medium px-5 py-3">Salida</th>
                  <th className="text-left font-medium px-5 py-3">Horas</th>
                  <th className="text-left font-medium px-5 py-3">Estatus</th>
                  <th className="text-left font-medium px-5 py-3">Fotos</th>
                  <th className="text-left font-medium px-5 py-3">Ubicación</th>
                  <th className="text-left font-medium px-5 py-3">Editar</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {data.items.map((j) => (
                  <tr key={j.id}>
                    <td className="px-5 py-3 text-ink">{j.tecnico_nombre}</td>
                    <td className="px-5 py-3 text-ink-muted">{formatFecha(j.fecha)}</td>
                    <td className="px-5 py-3 tabular-nums text-ink-muted">{formatHora(j.entrada_hora)}</td>
                    <td className="px-5 py-3 tabular-nums text-ink-muted">
                      {j.salida_hora ? formatHora(j.salida_hora) : "—"}
                    </td>
                    <td className="px-5 py-3 tabular-nums text-ink-muted">{j.horas_trabajadas ?? "—"}</td>
                    <td className="px-5 py-3">
                      {j.estatus === "activa" ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium bg-accent/10 text-amber-700">
                          <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-500 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
                          </span>
                          En jornada
                        </span>
                      ) : (
                        <Badge status={j.estatus} />
                      )}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => setFoto({ path: j.entrada_foto_url, title: "Foto de entrada" })}
                          className="p-1.5 rounded-lg hover:bg-surface-muted text-ink-muted cursor-pointer"
                          aria-label="Ver foto de entrada"
                          title="Foto de entrada"
                        >
                          <CameraIcon className="h-4 w-4" />
                        </button>
                        {j.salida_foto_url && (
                          <button
                            onClick={() => setFoto({ path: j.salida_foto_url, title: "Foto de salida" })}
                            className="p-1.5 rounded-lg hover:bg-surface-muted text-ink-muted cursor-pointer"
                            aria-label="Ver foto de salida"
                            title="Foto de salida"
                          >
                            <CameraIcon className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setMapaJornada(j)}
                        className="p-1.5 rounded-lg hover:bg-surface-muted text-ink-muted cursor-pointer"
                        aria-label="Ver ubicación en el mapa"
                        title="Ver ubicación"
                      >
                        <MapPinIcon className="h-4 w-4" />
                      </button>
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => setEditJornada(j)}
                        className="p-1.5 rounded-lg hover:bg-surface-muted text-ink-muted cursor-pointer"
                        aria-label="Editar hora de entrada y salida"
                        title="Editar jornada"
                      >
                        <PencilIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="flex items-center justify-between px-5 py-3 border-t border-border text-sm text-ink-muted">
          <span>
            Página {page} de {totalPages} · {data.total} registros
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40 hover:bg-surface-muted cursor-pointer disabled:cursor-not-allowed"
            >
              Anterior
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40 hover:bg-surface-muted cursor-pointer disabled:cursor-not-allowed"
            >
              Siguiente
            </button>
          </div>
        </div>
      </div>

      {foto && <PhotoModal relativePath={foto.path} title={foto.title} onClose={() => setFoto(null)} />}
      {mapaJornada && <MapaModal jornada={mapaJornada} onClose={() => setMapaJornada(null)} />}
      {editJornada && (
        <EditarJornadaModal
          jornada={editJornada}
          onSave={handleGuardarJornada}
          onClose={() => setEditJornada(null)}
        />
      )}
    </div>
  );
}
