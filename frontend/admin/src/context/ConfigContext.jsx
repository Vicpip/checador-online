import { createContext, useContext, useEffect, useState } from "react";
import api from "../api/client";

const ConfigContext = createContext(null);

const FALLBACK = {
  company_name: "field-check",
  primary_color: "#1F5FA5",
  secondary_color: "#1D9E75",
  accent_color: "#F59E0B",
  logo_url: null,
  worker_role_label: "Técnico",
  admin_role_label: "Administrador",
  hora_inicio_jornada: "08:00:00",
  hora_limite_entrada: "08:00:00",
  hora_limite_alerta: "09:30:00",
};

/** Derive a readable foreground (black/white) for a given hex background. */
function contrastFg(hex) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#111827" : "#ffffff";
}

function applyTheme(config) {
  const root = document.documentElement;
  root.style.setProperty("--color-primary", config.primary_color);
  root.style.setProperty("--color-primary-fg", contrastFg(config.primary_color));
  root.style.setProperty("--color-secondary", config.secondary_color);
  root.style.setProperty("--color-secondary-fg", contrastFg(config.secondary_color));
  root.style.setProperty("--color-accent", config.accent_color);
  root.style.setProperty("--color-accent-fg", contrastFg(config.accent_color));
  root.style.setProperty("--color-success", config.secondary_color);
  root.style.setProperty("--color-warning", config.accent_color);
  document.title = `${config.company_name} — Admin`;
}

export function ConfigProvider({ children }) {
  const [config, setConfig] = useState(FALLBACK);
  const [loading, setLoading] = useState(true);

  async function reload() {
    try {
      const res = await api.get("/config");
      setConfig(res.data);
      applyTheme(res.data);
    } catch {
      applyTheme(FALLBACK); // stay usable/branded-by-default if the API is unreachable
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, []);

  return (
    <ConfigContext.Provider value={{ config, loading, reload }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const ctx = useContext(ConfigContext);
  if (!ctx) throw new Error("useConfig must be used inside ConfigProvider");
  return ctx;
}
