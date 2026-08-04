import {
  CalendarDaysIcon,
  CheckCircleIcon,
  ClockIcon,
  UsersIcon,
} from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import api from "../api/client";
import Badge from "../components/Badge";
import StatCard from "../components/StatCard";
import AusenciaModal from "../components/AusenciaModal";
import ResponderAusenciaModal from "../components/ResponderAusenciaModal";
import { AUSENCIA_LABELS } from "../components/AusenciasCalendario";
import { useConfig } from "../context/ConfigContext";
import { formatFecha, formatHora, hoyISO } from "../utils/formato";

export default function Dashboard() {
  const { config } = useConfig();
  const [tecnicos, setTecnicos] = useState([]);
  const [jornadasHoy, setJornadasHoy] = useState([]);
  const [serviciosHoy, setServiciosHoy] = useState([]);
  const [ausenciasHoy, setAusenciasHoy] = useState([]);
  const [solicitudesPendientes, setSolicitudesPendientes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalAusencia, setModalAusencia] = useState(false);
  const [modalRespuesta, setModalRespuesta] = useState(null); // { ausencia, estatus } | null

  function cargarDatos() {
    const hoy = hoyISO();
    return Promise.all([
      api.get("/admin/tecnicos"),
      api.get("/admin/jornadas", { params: { fecha_inicio: hoy, fecha_fin: hoy, limit: 100 } }),
      api.get("/admin/servicios", { params: { fecha_inicio: hoy, fecha_fin: hoy } }),
      api.get("/admin/ausencias", { params: { fecha_inicio: hoy, fecha_fin: hoy, estatus: "aprobada" } }),
      api.get("/admin/ausencias", { params: { estatus: "pendiente" } }),
    ]).then(([tecnicosRes, jornadasRes, serviciosRes, ausenciasRes, pendientesRes]) => {
      setTecnicos(tecnicosRes.data);
      setJornadasHoy(jornadasRes.data.items);
      setServiciosHoy(serviciosRes.data);
      setAusenciasHoy(ausenciasRes.data);
      setSolicitudesPendientes(pendientesRes.data);
    });
  }

  async function handleResponder(ausenciaId, body) {
    await api.patch(`/admin/ausencias/${ausenciaId}/responder`, body);
    await cargarDatos();
  }

  useEffect(() => {
    cargarDatos().finally(() => setLoading(false));
  }, []);

  async function handleSaveAusencia(form) {
    const fechaFin = form.tipo === "vacaciones" && form.fechaFin ? form.fechaFin : form.fecha;
    const fechas = [];
    for (
      let d = new Date(`${form.fecha}T00:00:00`);
      d <= new Date(`${fechaFin}T00:00:00`);
      d.setDate(d.getDate() + 1)
    ) {
      fechas.push(d.toISOString().slice(0, 10));
    }
    for (const fecha of fechas) {
      await api.post("/admin/ausencias", {
        tecnico_id: form.tecnico_id,
        fecha,
        tipo: form.tipo,
        notas: form.notas || null,
      });
    }
    await cargarDatos();
  }

  const enCurso = jornadasHoy.filter((j) => j.estatus === "activa").length;
  const completas = jornadasHoy.filter((j) => j.estatus === "completa").length;

  const idsConJornadaHoy = new Set(jornadasHoy.map((j) => j.tecnico_id));
  const ausenciaPorTecnico = new Map(ausenciasHoy.map((a) => [a.tecnico_id, a]));
  const tecnicosSinRegistro = tecnicos.filter((t) => !idsConJornadaHoy.has(t.id));
  const conAusencia = tecnicosSinRegistro.filter((t) => ausenciaPorTecnico.has(t.id));
  const sinJustificar = tecnicosSinRegistro.filter((t) => !ausenciaPorTecnico.has(t.id));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Dashboard</h1>
        <p className="text-ink-muted mt-1">Resumen de hoy en {config.company_name}</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label={`${config.worker_role_label}s activos`} value={tecnicos.length} icon={UsersIcon} tone="primary" />
        <StatCard label="Check-ins hoy" value={jornadasHoy.length} icon={ClockIcon} tone="accent" />
        <StatCard label="En jornada" value={enCurso} icon={CheckCircleIcon} tone="secondary" />
        <StatCard label="Servicios hoy" value={serviciosHoy.length} icon={CalendarDaysIcon} tone="primary" />
      </div>

      <div className="rounded-lg border border-border bg-surface shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-ink">Actividad de hoy</h2>
        </div>
        {loading ? (
          <p className="p-5 text-ink-muted">Cargando…</p>
        ) : jornadasHoy.length === 0 ? (
          <p className="p-5 text-ink-muted">
            Ningún {config.worker_role_label.toLowerCase()} ha registrado entrada hoy todavía.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-surface-muted text-ink-muted">
                <tr>
                  <th className="text-left font-medium px-5 py-3">{config.worker_role_label}</th>
                  <th className="text-left font-medium px-5 py-3">Entrada</th>
                  <th className="text-left font-medium px-5 py-3">Salida</th>
                  <th className="text-left font-medium px-5 py-3">Estatus</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {jornadasHoy.map((j) => (
                  <tr key={j.id}>
                    <td className="px-5 py-3 text-ink">{j.tecnico_nombre}</td>
                    <td className="px-5 py-3 tabular-nums text-ink-muted">{formatHora(j.entrada_hora)}</td>
                    <td className="px-5 py-3 tabular-nums text-ink-muted">
                      {j.salida_hora ? formatHora(j.salida_hora) : "—"}
                    </td>
                    <td className="px-5 py-3">
                      <Badge status={j.estatus} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border">
          <h2 className="font-semibold text-ink">Solicitudes pendientes</h2>
        </div>
        {loading ? (
          <p className="p-5 text-ink-muted">Cargando…</p>
        ) : solicitudesPendientes.length === 0 ? (
          <p className="p-5 text-ink-muted">No hay solicitudes de permiso pendientes.</p>
        ) : (
          <ul className="divide-y divide-border">
            {solicitudesPendientes.map((s) => {
              const tecnico = tecnicos.find((t) => t.id === s.tecnico_id);
              return (
                <li key={s.id} className="px-5 py-3 flex items-center justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-ink font-medium">{tecnico?.nombre || "—"}</p>
                    <p className="text-sm text-ink-muted">
                      {AUSENCIA_LABELS[s.tipo] || s.tipo} · {formatFecha(s.fecha)}
                      {s.notas && ` · "${s.notas}"`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setModalRespuesta({ ausencia: s, estatus: "aprobada" })}
                      className="rounded-lg bg-secondary text-secondary-fg font-medium px-3 py-2 text-sm hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => setModalRespuesta({ ausencia: s, estatus: "rechazada" })}
                      className="rounded-lg bg-danger text-white font-medium px-3 py-2 text-sm hover:opacity-90 transition-opacity cursor-pointer"
                    >
                      Rechazar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface shadow-card overflow-hidden">
        <div className="px-5 py-4 border-b border-border flex items-center justify-between gap-3">
          <h2 className="font-semibold text-ink">{config.worker_role_label}s sin registro hoy</h2>
          <button
            onClick={() => setModalAusencia(true)}
            className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-muted transition-colors cursor-pointer"
          >
            + Registrar ausencia
          </button>
        </div>
        {loading ? (
          <p className="p-5 text-ink-muted">Cargando…</p>
        ) : tecnicosSinRegistro.length === 0 ? (
          <p className="p-5 text-ink-muted">
            Todos los {config.worker_role_label.toLowerCase()}s han registrado entrada hoy.
          </p>
        ) : (
          <div className="divide-y divide-border">
            {conAusencia.length > 0 && (
              <div className="px-5 py-3">
                <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">
                  Con ausencia registrada
                </p>
                <ul className="space-y-2">
                  {conAusencia.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3">
                      <span className="text-ink">{t.nombre}</span>
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-700">
                        {AUSENCIA_LABELS[ausenciaPorTecnico.get(t.id).tipo] || ausenciaPorTecnico.get(t.id).tipo}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {sinJustificar.length > 0 && (
              <div className="px-5 py-3">
                <p className="text-xs font-medium text-ink-muted uppercase tracking-wide mb-2">
                  Sin justificación
                </p>
                <ul className="space-y-2">
                  {sinJustificar.map((t) => (
                    <li key={t.id} className="flex items-center justify-between gap-3">
                      <span className="text-ink">{t.nombre}</span>
                      <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-danger/10 text-danger">
                        Sin registro
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>

      {modalAusencia && (
        <AusenciaModal
          tecnicos={tecnicos}
          workerLabel={config.worker_role_label}
          onSave={handleSaveAusencia}
          onClose={() => setModalAusencia(false)}
        />
      )}

      {modalRespuesta && (
        <ResponderAusenciaModal
          ausencia={modalRespuesta.ausencia}
          estatus={modalRespuesta.estatus}
          tecnicoNombre={tecnicos.find((t) => t.id === modalRespuesta.ausencia.tecnico_id)?.nombre || "—"}
          tipoLabel={AUSENCIA_LABELS[modalRespuesta.ausencia.tipo] || modalRespuesta.ausencia.tipo}
          onSave={handleResponder}
          onClose={() => setModalRespuesta(null)}
        />
      )}
    </div>
  );
}
