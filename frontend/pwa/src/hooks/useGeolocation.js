import { useCallback, useState } from "react";

/**
 * Wraps navigator.geolocation.getCurrentPosition in a promise-friendly hook.
 * Never fails silently — permission-denied, unsupported browser, and
 * timeout all resolve to a clear, user-facing message (CONTEXT_CHECADOR.md
 * hard rule). enableHighAccuracy is always on; precision_m is reported to
 * the caller as informational context only, never used to gate anything.
 */
export function useGeolocation() {
  const [status, setStatus] = useState("idle"); // idle | locating | success | error
  const [error, setError] = useState(null);

  const locate = useCallback(() => {
    setStatus("locating");
    setError(null);

    return new Promise((resolve, reject) => {
      if (!("geolocation" in navigator)) {
        const message = "Este dispositivo no soporta geolocalización. No es posible registrar tu ubicación.";
        setStatus("error");
        setError(message);
        reject(new Error(message));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          setStatus("success");
          resolve({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
            precision_m: position.coords.accuracy,
          });
        },
        (err) => {
          let message;
          if (err.code === err.PERMISSION_DENIED) {
            message =
              "Permiso de ubicación denegado. Actívalo en la configuración de tu navegador para poder registrar tu entrada/salida.";
          } else if (err.code === err.POSITION_UNAVAILABLE) {
            message = "No se pudo determinar tu ubicación. Intenta de nuevo en un lugar con mejor señal.";
          } else if (err.code === err.TIMEOUT) {
            message = "La búsqueda de tu ubicación tardó demasiado. Intenta de nuevo.";
          } else {
            message = "Ocurrió un error al obtener tu ubicación.";
          }
          setStatus("error");
          setError(message);
          reject(new Error(message));
        },
        { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
      );
    });
  }, []);

  return { locate, status, error };
}
