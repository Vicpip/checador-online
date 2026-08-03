import { XMarkIcon } from "@heroicons/react/24/outline";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapContainer, Marker, Polyline, Popup, TileLayer } from "react-leaflet";
import { formatFechaHora } from "../utils/formato";

function marcador(color) {
  return L.divIcon({
    className: "",
    html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:${color};border:2px solid white;box-shadow:0 0 0 1px rgba(0,0,0,0.25)"></span>`,
    iconSize: [16, 16],
    iconAnchor: [8, 8],
    popupAnchor: [0, -8],
  });
}

const ICONO_ENTRADA = marcador("#16a34a"); // green
const ICONO_SALIDA = marcador("#dc2626"); // red

function precisionTexto(m) {
  return m != null ? `${Math.round(m)} m` : "—";
}

function coordTexto(lat, lng) {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/** Shows check-in/check-out GPS points for a jornada on a Leaflet + OpenStreetMap map. */
export default function MapaModal({ jornada, onClose }) {
  const puntoEntrada = [jornada.entrada_lat, jornada.entrada_lng];
  const tieneSalida = jornada.salida_lat != null && jornada.salida_lng != null;
  const puntoSalida = tieneSalida ? [jornada.salida_lat, jornada.salida_lng] : null;
  const center = puntoSalida
    ? [(puntoEntrada[0] + puntoSalida[0]) / 2, (puntoEntrada[1] + puntoSalida[1]) / 2]
    : puntoEntrada;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true">
      <div className="bg-surface rounded-lg shadow-xl max-w-2xl w-full overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div>
            <h3 className="font-medium text-ink">Ubicación de check-in / check-out</h3>
            <p className="text-xs text-ink-muted">
              {jornada.tecnico_nombre} · {formatFechaHora(jornada.entrada_hora).split(" ")[0]}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface-muted cursor-pointer" aria-label="Cerrar">
            <XMarkIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="h-[420px] w-full">
          <MapContainer center={center} zoom={16} style={{ height: "100%", width: "100%" }} scrollWheelZoom>
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Marker position={puntoEntrada} icon={ICONO_ENTRADA}>
              <Popup>
                <strong>Entrada</strong>
                <br />
                {formatFechaHora(jornada.entrada_hora)}
                <br />
                {coordTexto(jornada.entrada_lat, jornada.entrada_lng)}
                <br />
                Precisión: {precisionTexto(jornada.entrada_precision_m)}
              </Popup>
            </Marker>
            {tieneSalida && (
              <>
                <Marker position={puntoSalida} icon={ICONO_SALIDA}>
                  <Popup>
                    <strong>Salida</strong>
                    <br />
                    {formatFechaHora(jornada.salida_hora)}
                    <br />
                    {coordTexto(jornada.salida_lat, jornada.salida_lng)}
                    <br />
                    Precisión: {precisionTexto(jornada.salida_precision_m)}
                  </Popup>
                </Marker>
                <Polyline positions={[puntoEntrada, puntoSalida]} pathOptions={{ color: "#1F5FA5", weight: 3, dashArray: "6 6" }} />
              </>
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
