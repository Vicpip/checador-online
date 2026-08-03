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
import { useConfig } from "../context/ConfigContext";
import { formatHora, hoyISO } from "../utils/formato";

export default function Dashboard() {
  const { config } = useConfig();
  const [tecnicos, setTecnicos] = useState([]);
  const [jornadasHoy, setJornadasHoy] = useState([]);
  const [serviciosHoy, setServiciosHoy] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hoy = hoyISO();
    Promise.all([
      api.get("/admin/tecnicos"),
      api.get("/admin/jornadas", { params: { fecha_inicio: hoy, fecha_fin: hoy, limit: 100 } }),
      api.get("/admin/servicios", { params: { fecha_inicio: hoy, fecha_fin: hoy } }),
    ])
      .then(([tecnicosRes, jornadasRes, serviciosRes]) => {
        setTecnicos(tecnicosRes.data);
        setJornadasHoy(jornadasRes.data.items);
        setServiciosHoy(serviciosRes.data);
      })
      .finally(() => setLoading(false));
  }, []);

  const enCurso = jornadasHoy.filter((j) => j.estatus === "activa").length;
  const completas = jornadasHoy.filter((j) => j.estatus === "completa").length;

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
    </div>
  );
}
