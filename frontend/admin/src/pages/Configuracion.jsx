import { ArrowUpTrayIcon } from "@heroicons/react/24/outline";
import { useState } from "react";
import api from "../api/client";
import { useConfig } from "../context/ConfigContext";

function ColorField({ label, value, onChange }) {
  return (
    <div>
      <label className="block text-sm font-medium text-ink mb-1.5">{label}</label>
      <div className="flex items-center gap-3">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-14 rounded-lg border border-border cursor-pointer"
          aria-label={label}
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          pattern="^#[0-9A-Fa-f]{6}$"
          className="w-28 rounded-lg border border-border px-3 py-2 text-sm font-mono uppercase focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
        />
      </div>
    </div>
  );
}

export default function Configuracion() {
  const { config, reload } = useConfig();
  const [companyName, setCompanyName] = useState(config.company_name);
  const [primary, setPrimary] = useState(config.primary_color);
  const [secondary, setSecondary] = useState(config.secondary_color);
  const [accent, setAccent] = useState(config.accent_color);
  const [horaInicioJornada, setHoraInicioJornada] = useState(config.hora_inicio_jornada.slice(0, 5));
  const [horaLimiteEntrada, setHoraLimiteEntrada] = useState(config.hora_limite_entrada.slice(0, 5));
  const [logoFile, setLogoFile] = useState(null);
  const [logoPreview, setLogoPreview] = useState(config.logo_url);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  function handleLogoChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setError("El logo debe pesar menos de 2MB.");
      return;
    }
    setError("");
    setLogoFile(file);
    const reader = new FileReader();
    reader.onload = (ev) => setLogoPreview(ev.target.result);
    reader.readAsDataURL(file);
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");
    try {
      await api.put("/admin/config", {
        company_name: companyName,
        primary_color: primary,
        secondary_color: secondary,
        accent_color: accent,
        hora_inicio_jornada: horaInicioJornada,
        hora_limite_entrada: horaLimiteEntrada,
      });
      if (logoFile) {
        const formData = new FormData();
        formData.append("file", logoFile);
        await api.post("/admin/config/logo", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      await reload();
      setLogoFile(null);
      setMessage("Cambios guardados. Toda la app ya refleja la nueva marca.");
    } catch {
      setError("No se pudieron guardar los cambios.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Configuración</h1>
        <p className="text-ink-muted mt-1">
          Marca de la empresa — se aplica en vivo a este panel y a la app de{" "}
          {config.worker_role_label.toLowerCase()}s, sin necesidad de recompilar.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form onSubmit={handleSave} className="rounded-lg border border-border bg-surface shadow-card p-5 space-y-5">
          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Nombre de la empresa</label>
            <input
              required
              maxLength={120}
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-ink mb-1.5">Logo</label>
            <label className="flex items-center gap-2 rounded-lg border border-dashed border-border px-4 py-3 cursor-pointer hover:bg-surface-muted transition-colors w-fit">
              <ArrowUpTrayIcon className="h-5 w-5 text-ink-muted" />
              <span className="text-sm text-ink-muted">Subir imagen (PNG, JPG, SVG, WebP · máx 2MB)</span>
              <input type="file" accept="image/png,image/jpeg,image/svg+xml,image/webp" onChange={handleLogoChange} className="hidden" />
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <ColorField label="Primario" value={primary} onChange={setPrimary} />
            <ColorField label="Secundario" value={secondary} onChange={setSecondary} />
            <ColorField label="Acento" value={accent} onChange={setAccent} />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1 border-t border-border">
            <div className="pt-4">
              <label className="block text-sm font-medium text-ink mb-1.5">Hora de inicio de jornada</label>
              <input
                type="time"
                required
                value={horaInicioJornada}
                onChange={(e) => setHoraInicioJornada(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
              />
            </div>
            <div className="pt-4">
              <label className="block text-sm font-medium text-ink mb-1.5">Hora límite de entrada</label>
              <input
                type="time"
                required
                value={horaLimiteEntrada}
                onChange={(e) => setHoraLimiteEntrada(e.target.value)}
                className="w-full rounded-lg border border-border px-3 py-2.5 focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
              />
              <p className="mt-1 text-xs text-ink-muted">Check-in después de esta hora se marca como tarde.</p>
            </div>
          </div>

          <div className="pt-4 border-t border-border">
            <label className="block text-sm font-medium text-ink mb-1.5">Hora límite de alerta</label>
            <input
              type="time"
              disabled
              value={config.hora_limite_alerta.slice(0, 5)}
              className="w-full sm:w-1/2 rounded-lg border border-border px-3 py-2.5 bg-surface-muted text-ink-muted cursor-not-allowed"
            />
            <p className="mt-1 text-xs text-ink-muted">
              Hora a la que se revisa si hay {config.worker_role_label.toLowerCase()}s sin check-in
              y se notifica por correo a los administradores. Se configura con la variable de entorno{" "}
              <code>HORA_LIMITE_ALERTA</code> — cambiarla requiere reiniciar el servidor, no se puede
              editar desde aquí.
            </p>
          </div>

          {error && <p role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">{error}</p>}
          {message && <p role="status" className="text-sm text-secondary bg-secondary/10 rounded-lg px-3 py-2">{message}</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-primary text-primary-fg font-medium px-5 py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer"
          >
            {saving ? "Guardando…" : "Guardar cambios"}
          </button>
        </form>

        {/* Live preview — scoped CSS vars only affect this panel until Save is pressed */}
        <div
          className="rounded-lg border border-border overflow-hidden shadow-card"
          style={{
            "--color-primary": primary,
            "--color-secondary": secondary,
            "--color-accent": accent,
          }}
        >
          <div className="bg-primary text-primary-fg px-5 py-4 flex items-center gap-3">
            {logoPreview ? (
              <img src={logoPreview} alt="Logo preview" className="h-9 w-9 rounded-lg object-contain bg-white/10" />
            ) : (
              <div className="h-9 w-9 rounded-lg bg-white/20 flex items-center justify-center font-bold">
                {companyName.slice(0, 1).toUpperCase() || "?"}
              </div>
            )}
            <div>
              <p className="font-semibold">{companyName || "Nombre de la empresa"}</p>
              <p className="text-xs opacity-80">Vista previa en vivo</p>
            </div>
          </div>
          <div className="bg-surface p-5 space-y-3">
            <div className="flex gap-2">
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-secondary text-white">
                Completa
              </span>
              <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-medium bg-accent text-white">
                Pendiente
              </span>
            </div>
            <button className="rounded-lg bg-primary text-white px-4 py-2 text-sm font-medium">
              Botón primario
            </button>
            <p className="text-sm text-ink-muted">
              Así se verán los botones, insignias y encabezados en ambas apps.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
