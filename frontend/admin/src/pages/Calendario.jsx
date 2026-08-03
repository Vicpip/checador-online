import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import { useEffect, useRef, useState } from "react";
import api from "../api/client";
import AusenciaModal from "../components/AusenciaModal";
import { AUSENCIA_LABELS } from "../components/AusenciasCalendario";
import ServicioModal from "../components/ServicioModal";
import { useConfig } from "../context/ConfigContext";
import { formatHoraSimple } from "../utils/formato";

const ESTATUS_COLOR_VAR = {
  pendiente: "var(--color-ink-muted)",
  en_curso: "var(--color-accent)",
  completado: "var(--color-secondary)",
  cancelado: "var(--color-danger)",
};

// Vacaciones/permiso/incapacidad are fixed status colors (not brand tokens) —
// same "blue = ausencia" convention as AusenciasCalendario.jsx's month grid.
const AUSENCIA_TIPO_COLOR = {
  vacaciones: "#3b82f6",
  permiso_con_goce: "#a855f7",
  permiso_sin_goce: "#a855f7",
  incapacidad: "#f97316",
  falta: "var(--color-danger)",
};

export default function Calendario() {
  const { config } = useConfig();
  const [clientes, setClientes] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [events, setEvents] = useState([]);
  const [modalServicio, setModalServicio] = useState(null); // { initial } | null
  const [modalAusencia, setModalAusencia] = useState(false);
  const calendarRef = useRef(null);

  useEffect(() => {
    api.get("/admin/clientes").then((res) => setClientes(res.data));
    api.get("/admin/tecnicos").then((res) => setTecnicos(res.data));
  }, []);

  async function loadEventos(info) {
    const fecha_inicio = info.startStr.slice(0, 10);
    const fecha_fin = info.endStr.slice(0, 10);
    const [serviciosRes, ausenciasRes, faltasRes] = await Promise.all([
      api.get("/admin/servicios", { params: { fecha_inicio, fecha_fin } }),
      api.get("/admin/ausencias", { params: { fecha_inicio, fecha_fin } }),
      api.get("/admin/ausencias/faltas-injustificadas", { params: { fecha_inicio, fecha_fin } }),
    ]);
    const tecnicoNombre = (id) => tecnicos.find((t) => t.id === id)?.nombre || "";

    const eventosServicio = serviciosRes.data.map((s) => ({
      id: `s-${s.id}`,
      title: s.hora
        ? `${formatHoraSimple(s.hora)} · ${s.cliente_nombre} · ${s.tecnico_nombre}`
        : `${s.cliente_nombre} · ${s.tecnico_nombre}`,
      date: s.fecha,
      backgroundColor: ESTATUS_COLOR_VAR[s.estatus],
      borderColor: ESTATUS_COLOR_VAR[s.estatus],
      extendedProps: { kind: "servicio", servicio: s },
    }));

    const eventosAusencia = ausenciasRes.data.map((a) => ({
      id: `a-${a.id}`,
      title: `${tecnicoNombre(a.tecnico_id)} · ${AUSENCIA_LABELS[a.tipo] || a.tipo}`,
      date: a.fecha,
      backgroundColor: AUSENCIA_TIPO_COLOR[a.tipo] || "var(--color-ink-muted)",
      borderColor: AUSENCIA_TIPO_COLOR[a.tipo] || "var(--color-ink-muted)",
      extendedProps: { kind: "ausencia", ausencia: a },
    }));

    const eventosFalta = faltasRes.data.map((f) => ({
      id: `f-${f.tecnico_id}-${f.fecha}`,
      title: `${f.tecnico_nombre} · Falta injustificada`,
      date: f.fecha,
      backgroundColor: "var(--color-danger)",
      borderColor: "var(--color-danger)",
      extendedProps: { kind: "falta" },
    }));

    setEvents([...eventosServicio, ...eventosAusencia, ...eventosFalta]);
  }

  function refresh() {
    const api2 = calendarRef.current?.getApi();
    if (api2) {
      loadEventos(
        api2.view.currentStart
          ? { startStr: api2.view.activeStart.toISOString(), endStr: api2.view.activeEnd.toISOString() }
          : {}
      );
    }
  }

  async function handleSaveServicio(form) {
    if (modalServicio.initial?.id) {
      await api.put(`/admin/servicios/${modalServicio.initial.id}`, {
        estatus: form.estatus,
        descripcion: form.descripcion,
        notas: form.notas,
        fecha: form.fecha,
        hora: form.hora,
      });
    } else {
      await api.post("/admin/servicios", form);
    }
    setModalServicio(null);
    refresh();
  }

  async function handleDeleteServicio(id) {
    if (!window.confirm("¿Eliminar este servicio?")) return;
    await api.delete(`/admin/servicios/${id}`);
    setModalServicio(null);
    refresh();
  }

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
    refresh();
  }

  async function handleDeleteAusencia(ausencia) {
    const label = AUSENCIA_LABELS[ausencia.tipo] || ausencia.tipo;
    if (!window.confirm(`¿Eliminar esta ausencia (${label})?`)) return;
    await api.delete(`/admin/ausencias/${ausencia.id}`);
    refresh();
  }

  if (clientes.length === 0 || tecnicos.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold text-ink">Calendario</h1>
        <p className="text-ink-muted">
          Registra al menos un cliente y un {config.worker_role_label.toLowerCase()} para poder
          asignar servicios.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-ink">Calendario</h1>
          <p className="text-ink-muted mt-1">Asignación de servicios y ausencias</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setModalAusencia(true)}
            className="rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-ink hover:bg-surface-muted transition-colors cursor-pointer"
          >
            + Registrar ausencia
          </button>
          <button
            onClick={() => setModalServicio({ initial: null })}
            className="rounded-lg bg-primary text-primary-fg font-medium px-4 py-2.5 hover:opacity-90 transition-opacity cursor-pointer"
          >
            + Nuevo servicio
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface shadow-card p-4 fc-field-check">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          height="auto"
          datesSet={loadEventos}
          dateClick={(info) => setModalServicio({ initial: { fecha: info.dateStr } })}
          events={events}
          eventClick={(info) => {
            const { kind, servicio, ausencia } = info.event.extendedProps;
            if (kind === "servicio") setModalServicio({ initial: servicio });
            else if (kind === "ausencia") handleDeleteAusencia(ausencia);
          }}
          headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
        />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-ink-muted">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: AUSENCIA_TIPO_COLOR.vacaciones }} />
          Vacaciones
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: AUSENCIA_TIPO_COLOR.permiso_con_goce }} />
          Permiso
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-orange-500" />
          Incapacidad
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full bg-danger" />
          Falta injustificada
        </span>
      </div>

      {modalServicio && (
        <ServicioModal
          initial={modalServicio.initial}
          clientes={clientes}
          tecnicos={tecnicos}
          workerLabel={config.worker_role_label}
          onSave={handleSaveServicio}
          onDelete={modalServicio.initial?.id ? handleDeleteServicio : undefined}
          onClose={() => setModalServicio(null)}
        />
      )}

      {modalAusencia && (
        <AusenciaModal
          tecnicos={tecnicos}
          workerLabel={config.worker_role_label}
          onSave={handleSaveAusencia}
          onClose={() => setModalAusencia(false)}
        />
      )}
    </div>
  );
}
