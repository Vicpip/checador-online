import { createStore, del, get, keys, set } from "idb-keyval";

/**
 * IndexedDB-backed queue of check-in/check-out attempts made while offline
 * (see pages/Jornada.jsx). A dedicated store (not idb-keyval's default) so
 * this doesn't collide if some other feature ever adopts idb-keyval too.
 * Each entry: { id, tipo: "entrada" | "salida", timestamp (ISO, the exact
 * moment of the attempt), fotoBase64, lat, lng, precision_m }.
 */
const store = createStore("fc-offline-checkins", "pendientes");

export async function addPendingCheckin(entry) {
  await set(entry.id, entry, store);
}

export async function getPendingCheckins() {
  const ids = await keys(store);
  const entries = await Promise.all(ids.map((id) => get(id, store)));
  // Chronological order so sync replays attempts in the order they happened.
  return entries.filter(Boolean).sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

export async function removePendingCheckin(id) {
  await del(id, store);
}
