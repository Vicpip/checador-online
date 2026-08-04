import { useEffect, useMemo, useState } from "react";
import api from "../api/client";
import StatCard from "../components/StatCard";
import EstadoJornadaBadge from "../components/EstadoJornadaBadge";
import { AUSENCIA_LABELS } from "../components/AusenciasCalendario";
import { useConfig } from "../context/ConfigContext";
import {
  ClockIcon,
  CalendarIcon,
  CheckBadgeIcon,
  ArrowDownTrayIcon,
  BoltIcon,
  ExclamationTriangleIcon,
  SunIcon,
  DocumentTextIcon,
  HeartIcon,
} from "@heroicons/react/24/outline";
import { formatFecha, formatHora, hoyISO, primerDiaMesISO } from "../utils/formato";

const FILA_TONO_CLASES = {
  jornadaCompleta: "bg-secondary/5",
  jornadaCorta: "bg-accent/5",
  ausencia: "bg-blue-50",
  falta: "bg-danger/5",
};

/** Green = jornada completa (incl. "salió tarde" / "entró antes"), yellow = jornada corta / sin salida. */
function tonoJornada(j) {
  if (!j.salida_hora) return "jornadaCorta";
  if (j.horas_esperadas != null && j.horas_trabajadas != null && j.horas_trabajadas < j.horas_esperadas) {
    return "jornadaCorta";
  }
  return "jornadaCompleta";
}

function construirFilas(reporte) {
  if (!reporte) return [];
  const filas = [
    ...reporte.jornadas.map((j) => ({ tipo: "jornada", fecha: j.fecha, jornada: j })),
    ...reporte.ausencias.map((a) => ({ tipo: "ausencia", fecha: a.fecha, ausencia: a })),
    ...reporte.fechas_falta_injustificada.map((fecha) => ({ tipo: "falta", fecha })),
  ];
  return filas.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export default function Reportes() {
  const { config } = useConfig();
  const [tecnicos, setTecnicos] = useState([]);
  const [tecnicoId, setTecnicoId] = useState("");
  const [fechaInicio, setFechaInicio] = useState(primerDiaMesISO());
  const [fechaFin, setFechaFin] = useState(hoyISO());
  const [reporte, setReporte] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const filas = useMemo(() => construirFilas(reporte), [reporte]);

  useEffect(() => {
    api.get("/admin/tecnicos").then((res) => {
      setTecnicos(res.data);
      if (res.data.length > 0) setTecnicoId(res.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!tecnicoId) return;
    setLoading(true);
    setError("");
    api
      .get("/admin/reportes", {
        params: { tecnico_id: tecnicoId, fecha_inicio: fechaInicio, fecha_fin: fechaFin },
      })
      .then((res) => setReporte(res.data))
      .catch(() => setError("No se pudo cargar el reporte."))
      .finally(() => setLoading(false));
  }, [tecnicoId, fechaInicio, fechaFin]);

  async function handleExportExcel() {
    setExporting(true);
    try {
      const { generarReporteExcel, slugParaArchivo } = await import("../utils/reporteExcel");
      const reportes = await Promise.all(
        tecnicos.map((t) =>
          api
            .get("/admin/reportes", {
              params: { tecnico_id: t.id, fecha_inicio: fechaInicio, fecha_fin: fechaFin },
            })
            .then((res) => res.data)
        )
      );
      const buffer = await generarReporteExcel({
        companyName: config.company_name,
        fechaInicio,
        fechaFin,
        reportes,
      });
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_${slugParaArchivo(config.company_name)}_${fechaInicio}_${fechaFin}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo exportar el Excel.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Reportes</h1>
          <p className="text-ink-muted mt-1">Horas trabajadas y puntualidad por {config.worker_role_label.toLowerCase()}</p>
        </div>
        <button
          onClick={handleExportExcel}
          disabled={tecnicos.length === 0 || exporting}
          className="flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-muted transition-colors disabled:opacity-60 cursor-pointer disabled:cursor-not-allowed"
        >
          <ArrowDownTrayIcon className="h-4 w-4" />
          {exporting ? "Exportando…" : "Exportar Excel"}
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface shadow-card p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">{config.worker_role_label}</label>
          <select
            value={tecnicoId}
            onChange={(e) => setTecnicoId(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
          >
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
            value={fechaInicio}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-muted mb-1">Hasta</label>
          <input
            type="date"
            value={fechaFin}
            onChange={(e) => setFechaFin(e.target.value)}
            className="rounded-lg border border-border px-3 py-2 text-sm focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
          />
        </div>
      </div>

      {error && <p className="text-danger">{error}</p>}
      {loading && <p className="text-ink-muted">Cargando…</p>}

      {reporte && !loading && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Horas trabajadas / esperadas"
              value={`${reporte.horas_totales} / ${reporte.horas_esperadas_totales}`}
              icon={ClockIcon}
              tone="primary"
            />
            <StatCard label="Horas extra" value={reporte.horas_extra_totales} icon={BoltIcon} tone="accent" />
            <StatCard
              label="Días puntuales / trabajados"
              value={`${reporte.dias_puntuales} / ${reporte.dias_trabajados}`}
              icon={CalendarIcon}
              tone="secondary"
            />
            <StatCard label="Puntualidad" value={`${reporte.puntualidad_pct}%`} icon={CheckBadgeIcon} tone="accent" />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              label="Faltas injustificadas"
              value={reporte.dias_faltados}
              icon={ExclamationTriangleIcon}
              tone="danger"
            />
            <StatCard label="Vacaciones" value={reporte.dias_vacaciones} icon={SunIcon} tone="info" />
            <StatCard label="Permisos" value={reporte.dias_permiso} icon={DocumentTextIcon} tone="info" />
            <StatCard label="Incapacidad" value={reporte.dias_incapacidad} icon={HeartIcon} tone="info" />
          </div>

          <div className="rounded-lg border border-border bg-surface shadow-card overflow-hidden">
            <div className="px-5 py-4 border-b border-border">
              <h2 className="font-semibold text-ink">{reporte.tecnico.nombre}</h2>
              <p className="text-sm text-ink-muted">{reporte.tecnico.email}</p>
            </div>
            {filas.length === 0 ? (
              <p className="p-5 text-ink-muted">Sin registros en este rango.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-surface-muted text-ink-muted">
                    <tr>
                      <th className="text-left font-medium px-5 py-3">Fecha</th>
                      <th className="text-left font-medium px-5 py-3">Tipo</th>
                      <th className="text-left font-medium px-5 py-3">Entrada</th>
                      <th className="text-left font-medium px-5 py-3">Salida</th>
                      <th className="text-left font-medium px-5 py-3">Horas trabajadas</th>
                      <th className="text-left font-medium px-5 py-3">Horas esperadas</th>
                      <th className="text-left font-medium px-5 py-3">Extra</th>
                      <th className="text-left font-medium px-5 py-3">Estado</th>
                      <th className="text-left font-medium px-5 py-3">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filas.map((fila) => {
                      if (fila.tipo === "jornada") {
                        const j = fila.jornada;
                        return (
                          <tr key={`j-${j.id}`} className={FILA_TONO_CLASES[tonoJornada(j)]}>
                            <td className="px-5 py-3 text-ink-muted">{formatFecha(j.fecha)}</td>
                            <td className="px-5 py-3 text-ink">Jornada</td>
                            <td className="px-5 py-3 tabular-nums text-ink-muted">{formatHora(j.entrada_hora)}</td>
                            <td className="px-5 py-3 tabular-nums text-ink-muted">
                              {j.salida_hora ? formatHora(j.salida_hora) : "—"}
                            </td>
                            <td className="px-5 py-3 tabular-nums text-ink-muted">{j.horas_trabajadas ?? "—"}</td>
                            <td className="px-5 py-3 tabular-nums text-ink-muted">{j.horas_esperadas ?? "—"}</td>
                            <td className="px-5 py-3 tabular-nums text-ink-muted">{j.horas_extra ?? "—"}</td>
                            <td className="px-5 py-3">
                              <EstadoJornadaBadge jornada={j} />
                            </td>
                            <td className="px-5 py-3 text-ink-muted">—</td>
                          </tr>
                        );
                      }
                      if (fila.tipo === "ausencia") {
                        const a = fila.ausencia;
                        return (
                          <tr key={`a-${a.id}`} className={FILA_TONO_CLASES.ausencia}>
                            <td className="px-5 py-3 text-ink-muted">{formatFecha(a.fecha)}</td>
                            <td className="px-5 py-3 text-ink">{AUSENCIA_LABELS[a.tipo] || a.tipo}</td>
                            <td className="px-5 py-3 text-ink-muted">—</td>
                            <td className="px-5 py-3 text-ink-muted">—</td>
                            <td className="px-5 py-3 text-ink-muted">—</td>
                            <td className="px-5 py-3 text-ink-muted">—</td>
                            <td className="px-5 py-3 text-ink-muted">—</td>
                            <td className="px-5 py-3">
                              <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-blue-100 text-blue-700">
                                Justificada
                              </span>
                            </td>
                            <td className="px-5 py-3 text-ink-muted">{a.notas || "—"}</td>
                          </tr>
                        );
                      }
                      return (
                        <tr key={`f-${fila.fecha}`} className={FILA_TONO_CLASES.falta}>
                          <td className="px-5 py-3 text-ink-muted">{formatFecha(fila.fecha)}</td>
                          <td className="px-5 py-3 text-ink">Falta injustificada</td>
                          <td className="px-5 py-3 text-ink-muted">—</td>
                          <td className="px-5 py-3 text-ink-muted">—</td>
                          <td className="px-5 py-3 text-ink-muted">—</td>
                          <td className="px-5 py-3 text-ink-muted">—</td>
                          <td className="px-5 py-3 text-ink-muted">—</td>
                          <td className="px-5 py-3">
                            <span className="inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium bg-danger/10 text-danger">
                              Falta injustificada
                            </span>
                          </td>
                          <td className="px-5 py-3 text-ink-muted">—</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
