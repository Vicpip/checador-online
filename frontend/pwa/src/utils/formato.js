/**
 * Date/time formatting — Mexican Spanish (DD/MM/YYYY, HH:MM 24h) rendered
 * explicitly in the business timezone (America/Mexico_City), independent of
 * the viewer's own browser/OS timezone. Backend timestamps are always UTC
 * (see backend/models.py) — every ISO string reaching the UI must go through
 * one of these before being shown to a user.
 */
const ZONA = "America/Mexico_City";

/** "2026-08-01T14:30:00+00:00" → "01/08/2026 08:30" */
export function formatFechaHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("es-MX", {
    timeZone: ZONA,
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** "2026-08-01T14:30:00+00:00" → "08:30" */
export function formatHora(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("es-MX", {
    timeZone: ZONA,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/** Plain date-only value "2026-08-01" → "01/08/2026" (no timezone conversion — a date has no instant to shift). */
export function formatFecha(fechaISO) {
  if (!fechaISO) return "—";
  const [y, m, d] = fechaISO.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Plain time-only value "08:00:00" or "08:00" → "08:00". */
export function formatHoraSimple(horaStr) {
  if (!horaStr) return "—";
  return horaStr.slice(0, 5);
}

/** Today's date as YYYY-MM-DD in the business timezone (for filters/pickers). */
export function hoyISO() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const map = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${map.year}-${map.month}-${map.day}`;
}

/** First day of the current month as YYYY-MM-DD in the business timezone. */
export function primerDiaMesISO() {
  return `${hoyISO().slice(0, 7)}-01`;
}

/** "lunes, 1 de agosto" style long date for the PWA home screen, in the business timezone. */
export function formatFechaLarga(date = new Date()) {
  return date.toLocaleDateString("es-MX", {
    timeZone: ZONA,
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}
