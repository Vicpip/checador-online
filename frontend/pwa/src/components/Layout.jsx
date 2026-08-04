import {
  ArrowRightStartOnRectangleIcon,
  BriefcaseIcon,
  CalendarDaysIcon,
  ClipboardDocumentCheckIcon,
  HomeIcon,
  WifiIcon,
} from "@heroicons/react/24/outline";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";
import { useOnlineStatus } from "../hooks/useOnlineStatus";

export default function Layout() {
  const { config } = useConfig();
  const { user, logout } = useAuth();
  const online = useOnlineStatus();

  return (
    <div className="min-h-dvh flex flex-col bg-surface-muted">
      <header className="sticky top-0 z-20 flex items-center justify-between gap-3 bg-surface border-b border-border px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {config.logo_url ? (
            <img src={config.logo_url} alt={`${config.company_name} logo`} className="h-8 w-8 rounded-lg object-contain" />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-primary text-primary-fg flex items-center justify-center text-sm font-bold">
              {config.company_name.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div className="min-w-0">
            <p className="font-semibold text-ink text-sm truncate">{config.company_name}</p>
            <p className="text-xs text-ink-muted truncate">{user?.nombre}</p>
          </div>
        </div>
        <button
          onClick={logout}
          className="p-2 rounded-lg hover:bg-surface-muted text-ink-muted cursor-pointer"
          aria-label="Cerrar sesión"
        >
          <ArrowRightStartOnRectangleIcon className="h-6 w-6" />
        </button>
      </header>

      {!online && (
        <div
          role="status"
          className="sticky top-[57px] z-10 flex items-center justify-center gap-2 bg-accent/10 text-amber-800 text-xs sm:text-sm px-4 py-2 text-center"
        >
          <WifiIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Sin conexión — los check-ins se guardarán y enviarán al recuperar señal.</span>
        </div>
      )}

      <main className="flex-1 px-4 py-5 pb-24 max-w-lg w-full mx-auto">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-20 bg-surface border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="max-w-lg mx-auto grid grid-cols-4">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${
                isActive ? "text-primary" : "text-ink-muted"
              }`
            }
          >
            <HomeIcon className="h-6 w-6" aria-hidden="true" />
            Jornada
          </NavLink>
          <NavLink
            to="/mis-servicios"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${
                isActive ? "text-primary" : "text-ink-muted"
              }`
            }
          >
            <BriefcaseIcon className="h-6 w-6" aria-hidden="true" />
            Mis servicios
          </NavLink>
          <NavLink
            to="/mis-jornadas"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${
                isActive ? "text-primary" : "text-ink-muted"
              }`
            }
          >
            <CalendarDaysIcon className="h-6 w-6" aria-hidden="true" />
            Mis jornadas
          </NavLink>
          <NavLink
            to="/mis-permisos"
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 py-2.5 text-xs font-medium ${
                isActive ? "text-primary" : "text-ink-muted"
              }`
            }
          >
            <ClipboardDocumentCheckIcon className="h-6 w-6" aria-hidden="true" />
            Mis permisos
          </NavLink>
        </div>
      </nav>
    </div>
  );
}
