import { CameraIcon, XCircleIcon } from "@heroicons/react/24/outline";
import { useRef, useState } from "react";
import { comprimirFoto } from "../utils/comprimirFoto";

/**
 * Opens the device camera (native capture on mobile) and hands back a
 * compressed JPEG blob ready to upload. Shows a preview so the worker can
 * confirm the shot before checking in/out.
 */
export default function CamaraCheckin({ label, onChange, disabled }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  async function handleFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setProcessing(true);
    setError("");
    try {
      const blob = await comprimirFoto(file);
      setPreview(URL.createObjectURL(blob));
      onChange(blob);
    } catch {
      setError("No se pudo procesar la foto. Intenta de nuevo.");
      onChange(null);
    } finally {
      setProcessing(false);
    }
  }

  function clear() {
    setPreview(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFile}
        disabled={disabled}
        className="hidden"
        id="camara-checkin-input"
      />

      {preview ? (
        <div className="relative w-full">
          <img src={preview} alt="Foto capturada" className="w-full h-56 object-cover rounded-lg border border-border" />
          <button
            type="button"
            onClick={clear}
            disabled={disabled}
            className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1.5 cursor-pointer"
            aria-label="Quitar foto"
          >
            <XCircleIcon className="h-6 w-6" />
          </button>
        </div>
      ) : (
        <label
          htmlFor="camara-checkin-input"
          className={`flex flex-col items-center justify-center gap-2 w-full h-56 rounded-lg border-2 border-dashed border-border text-ink-muted transition-colors ${
            disabled ? "opacity-50" : "hover:bg-surface-muted cursor-pointer"
          }`}
        >
          <CameraIcon className="h-9 w-9" aria-hidden="true" />
          <span className="text-sm font-medium">{processing ? "Procesando…" : label}</span>
        </label>
      )}

      {error && (
        <p role="alert" className="mt-2 text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
