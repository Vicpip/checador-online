import { ExclamationTriangleIcon, MapPinIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import api from "../api/client";
import CamaraCheckin from "../components/CamaraCheckin";
import EstadoJornada from "../components/EstadoJornada";
import { useConfig } from "../context/ConfigContext";
import { useGeolocation } from "../hooks/useGeolocation";
import { formatFechaLarga } from "../utils/formato";

const CACHE_KEY = "fc_jornada_hoy";

export default function Jornada() {
  const { config } = useConfig();
  const { locate, error: geoError } = useGeolocation();

  const [jornada, setJornada] = useState(() => {
    // Cache the last known state so workers still see their status with
    // spotty connectivity (hard requirement in CONTEXT_CHECADOR.md).
    const cached = sessionStorage.getItem(CACHE_KEY);
    return cached ? JSON.parse(cached) : undefined; // undefined = not loaded yet
  });
  const [foto, setFoto] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [offlineNotice, setOfflineNotice] = useState(false);

  function persist(data) {
    setJornada(data);
    if (data) sessionStorage.setItem(CACHE_KEY, JSON.stringify(data));
    else sessionStorage.removeItem(CACHE_KEY);
  }

  useEffect(() => {
    api
      .get("/me/jornada/hoy")
      .then((res) => {
        persist(res.data);
        setOfflineNotice(false);
      })
      .catch(() => {
        // Keep showing the cached value (if any) instead of blanking the screen.
        setOfflineNotice(true);
      });
  }, []);

  const modo = !jornada ? "checkin" : jornada.estatus === "activa" ? "checkout" : "done";

  async function handleSubmit() {
    if (!foto) {
      setSubmitError("Toma una foto antes de continuar.");
      return;
    }
    setSubmitError("");
    setSubmitting(true);
    try {
      const posicion = await locate(); // throws with a clear message on denial/failure
      const formData = new FormData();
      formData.append("foto", foto, "checkin.jpg");
      formData.append("lat", posicion.lat);
      formData.append("lng", posicion.lng);
      formData.append("precision_m", posicion.precision_m);

      const endpoint = modo === "checkin" ? "/jornadas/checkin" : "/jornadas/checkout";
      const res = await api.post(endpoint, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      persist(res.data);
      setFoto(null);
    } catch (err) {
      if (err.response?.status === 409) {
        setSubmitError("Ya registraste tu entrada hoy.");
      } else if (err.response?.status === 400) {
        setSubmitError("No hay una entrada activa para registrar salida.");
      } else if (err.message) {
        setSubmitError(err.message); // geolocation-specific message, already user-facing
      } else {
        setSubmitError("No se pudo registrar. Intenta de nuevo.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (jornada === undefined) {
    return <p className="text-ink-muted text-center py-10">Cargando tu jornada…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-ink">Hola, bienvenido</h1>
        <p className="text-ink-muted text-sm">{formatFechaLarga()}</p>
      </div>

      {offlineNotice && (
        <div className="flex items-start gap-2 rounded-lg bg-accent/10 text-amber-800 px-3 py-2.5 text-sm">
          <ExclamationTriangleIcon className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span>Sin conexión — mostrando tu último estado conocido.</span>
        </div>
      )}

      <EstadoJornada jornada={jornada} />

      {modo === "done" && (
        <p className="text-center text-ink-muted text-sm py-4">
          Ya completaste tu jornada de hoy. ¡Buen trabajo!
        </p>
      )}

      {modo !== "done" && (
        <div className="space-y-4">
          <CamaraCheckin
            label={modo === "checkin" ? "Tomar foto de entrada" : "Tomar foto de salida"}
            onChange={setFoto}
            disabled={submitting}
          />

          <div className="flex items-center gap-2 text-sm text-ink-muted">
            <MapPinIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Tu ubicación se registra automáticamente al confirmar.</span>
          </div>

          {(submitError || geoError) && (
            <p role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2.5">
              {submitError || geoError}
            </p>
          )}

          <button
            onClick={handleSubmit}
            disabled={submitting || !foto}
            className="w-full rounded-lg bg-primary text-primary-fg font-medium py-3.5 text-base hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer"
          >
            {submitting
              ? "Registrando…"
              : modo === "checkin"
              ? "Registrar entrada"
              : "Registrar salida"}
          </button>
        </div>
      )}
    </div>
  );
}
