import { useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";

export default function Login() {
  const { user, login } = useAuth();
  const { config } = useConfig();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (user) return <Navigate to="/" replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(
        err.response?.status === 401
          ? "Correo o contraseña incorrectos."
          : err.message || "No se pudo iniciar sesión."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-surface-muted px-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          {config.logo_url ? (
            <img
              src={config.logo_url}
              alt={`${config.company_name} logo`}
              className="h-14 w-14 rounded-xl object-contain mb-3"
            />
          ) : (
            <div className="h-14 w-14 rounded-xl bg-primary text-primary-fg flex items-center justify-center text-xl font-bold mb-3">
              {config.company_name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <h1 className="text-xl font-semibold text-ink">{config.company_name}</h1>
          <p className="text-sm text-ink-muted">Panel de {config.admin_role_label.toLowerCase()}</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-surface border border-border rounded-lg shadow-card p-6 space-y-4"
        >
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-ink mb-1.5">
              Correo electrónico
            </label>
            <input
              id="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-base focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-ink mb-1.5">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border px-3 py-2.5 text-base focus:border-primary focus:ring-2 focus:ring-primary/30 outline-none"
            />
          </div>

          {error && (
            <p role="alert" className="text-sm text-danger bg-danger/10 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-primary text-primary-fg font-medium py-2.5 hover:opacity-90 transition-opacity disabled:opacity-60 cursor-pointer"
          >
            {loading ? "Ingresando…" : "Ingresar"}
          </button>
        </form>
      </div>
    </div>
  );
}
