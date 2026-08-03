import dayGridPlugin from "@fullcalendar/daygrid";
import interactionPlugin from "@fullcalendar/interaction";
import FullCalendar from "@fullcalendar/react";
import { useEffect, useRef, useState } from "react";
import api from "../api/client";
import ServicioModal from "../components/ServicioModal";
import { useConfig } from "../context/ConfigContext";
import { formatHoraSimple } from "../utils/formato";

const ESTATUS_COLOR_VAR = {
  pendiente: "var(--color-ink-muted)",
  en_curso: "var(--color-accent)",
  completado: "var(--color-secondary)",
  cancelado: "var(--color-danger)",
};

export default function Calendario() {
  const { config } = useConfig();
  const [clientes, setClientes] = useState([]);
  const [tecnicos, setTecnicos] = useState([]);
  const [events, setEvents] = useState([]);
  const [modal, setModal] = useState(null); // { initial } | null
  const calendarRef = useRef(null);

  useEffect(() => {
    api.get("/admin/clientes").then((res) => setClientes(res.data));
    api.get("/admin/tecnicos").then((res) => setTecnicos(res.data));
  }, []);

  async function loadServicios(info) {
    const res = await api.get("/admin/servicios", {
      params: {
        fecha_inicio: info.startStr.slice(0, 10),
        fecha_fin: info.endStr.slice(0, 10),
      },
    });
    setEvents(
      res.data.map((s) => ({
        id: s.id,
        title: s.hora
          ? `${formatHoraSimple(s.hora)} · ${s.cliente_nombre} · ${s.tecnico_nombre}`
          : `${s.cliente_nombre} · ${s.tecnico_nombre}`,
        date: s.fecha,
        backgroundColor: ESTATUS_COLOR_VAR[s.estatus],
        borderColor: ESTATUS_COLOR_VAR[s.estatus],
        extendedProps: s,
      }))
    );
  }

  function refresh() {
    const api2 = calendarRef.current?.getApi();
    if (api2) loadServicios(api2.view.currentStart ? { startStr: api2.view.activeStart.toISOString(), endStr: api2.view.activeEnd.toISOString() } : {});
  }

  async function handleSave(form) {
    if (modal.initial?.id) {
      await api.put(`/admin/servicios/${modal.initial.id}`, {
        estatus: form.estatus,
        descripcion: form.descripcion,
        notas: form.notas,
        fecha: form.fecha,
        hora: form.hora,
      });
    } else {
      await api.post("/admin/servicios", form);
    }
    setModal(null);
    refresh();
  }

  async function handleDelete(id) {
    if (!window.confirm("¿Eliminar este servicio?")) return;
    await api.delete(`/admin/servicios/${id}`);
    setModal(null);
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
          <p className="text-ink-muted mt-1">Asignación de servicios</p>
        </div>
        <button
          onClick={() => setModal({ initial: null })}
          className="rounded-lg bg-primary text-primary-fg font-medium px-4 py-2.5 hover:opacity-90 transition-opacity cursor-pointer"
        >
          + Nuevo servicio
        </button>
      </div>

      <div className="rounded-lg border border-border bg-surface shadow-card p-4 fc-field-check">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, interactionPlugin]}
          initialView="dayGridMonth"
          height="auto"
          datesSet={loadServicios}
          dateClick={(info) => setModal({ initial: { fecha: info.dateStr } })}
          events={events}
          eventClick={(info) => setModal({ initial: info.event.extendedProps })}
          headerToolbar={{ left: "prev,next today", center: "title", right: "" }}
        />
      </div>

      {modal && (
        <ServicioModal
          initial={modal.initial}
          clientes={clientes}
          tecnicos={tecnicos}
          workerLabel={config.worker_role_label}
          onSave={handleSave}
          onDelete={modal.initial?.id ? handleDelete : undefined}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
