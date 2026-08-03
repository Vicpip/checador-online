const STYLES = {
  activa: "bg-accent/10 text-amber-700",
  completa: "bg-secondary/10 text-secondary",
  sin_salida: "bg-danger/10 text-danger",
  pendiente: "bg-slate-200 text-slate-700",
  en_curso: "bg-accent/10 text-amber-700",
  completado: "bg-secondary/10 text-secondary",
  cancelado: "bg-danger/10 text-danger",
};

const LABELS = {
  activa: "En curso",
  completa: "Completa",
  sin_salida: "Sin salida",
  pendiente: "Pendiente",
  en_curso: "En curso",
  completado: "Completado",
  cancelado: "Cancelado",
};

export default function Badge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
        STYLES[status] || "bg-slate-200 text-slate-700"
      }`}
    >
      {LABELS[status] || status}
    </span>
  );
}
