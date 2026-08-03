import { XMarkIcon } from "@heroicons/react/24/outline";
import { useEffect, useState } from "react";
import { fetchFotoUrl } from "../api/client";

/** Fetches a jornada photo through the authenticated /fotos endpoint and shows it in a modal. */
export default function PhotoModal({ relativePath, title, onClose }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let objectUrl;
    fetchFotoUrl(relativePath)
      .then((u) => {
        objectUrl = u;
        setUrl(u);
      })
      .catch(() => setError(true));
    return () => {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [relativePath]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="bg-surface rounded-lg shadow-xl max-w-lg w-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="font-medium text-ink">{title}</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-muted cursor-pointer" aria-label="Cerrar">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 flex items-center justify-center min-h-[240px]">
          {error && <p className="text-danger">No se pudo cargar la foto.</p>}
          {!error && !url && <p className="text-ink-muted">Cargando…</p>}
          {url && <img src={url} alt={title} className="max-h-[60vh] w-auto rounded-lg" />}
        </div>
      </div>
    </div>
  );
}
