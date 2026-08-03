import {
  Bars3Icon,
  CalendarDaysIcon,
  ChartBarIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  Squares2X2Icon,
  UserGroupIcon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useConfig } from "../context/ConfigContext";

const NAV = [
  { to: "/", label: "Dashboard", icon: Squares2X2Icon, end: true },
  { to: "/jornadas", label: "Jornadas", icon: ClipboardDocumentListIcon },
  { to: "/reportes", label: "Reportes", icon: ChartBarIcon },
  { to: "/calendario", label: "Calendario", icon: CalendarDaysIcon },
  { to: "/usuarios", label: "Usuarios", icon: UsersIcon },
  { to: "/clientes", label: "Clientes", icon: UserGroupIcon },
  { to: "/configuracion", label: "Configuración", icon: Cog6ToothIcon },
];

function SidebarContent({ onNavigate }) {
  const { config } = useConfig();
  const { user, logout } = useAuth();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-5 py-5 border-b border-border">
        {config.logo_url ? (
          <img
            src={config.logo_url}
            alt={`${config.company_name} logo`}
            className="h-9 w-9 rounded-lg object-contain bg-surface-muted"
          />
        ) : (
          <div className="h-9 w-9 rounded-lg bg-primary text-primary-fg flex items-center justify-center font-bold">
            {config.company_name.slice(0, 1).toUpperCase()}
          </div>
        )}
        <div className="min-w-0">
          <p className="font-semibold text-ink truncate">{config.company_name}</p>
          <p className="text-xs text-ink-muted">{config.admin_role_label}</p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {NAV.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-fg"
                  : "text-ink-muted hover:bg-surface-muted hover:text-ink"
              }`
            }
          >
            <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t border-border px-4 py-4">
        <p className="text-sm font-medium text-ink truncate">{user?.nombre}</p>
        <button
          onClick={logout}
          className="mt-2 w-full rounded-lg border border-border px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-muted hover:text-ink transition-colors cursor-pointer"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export default function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-dvh bg-surface-muted">
      {/* Desktop sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-64 lg:flex-col bg-surface border-r border-border">
        <SidebarContent />
      </aside>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <div className="fixed inset-y-0 left-0 w-72 bg-surface shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 p-2 rounded-lg hover:bg-surface-muted cursor-pointer"
              aria-label="Cerrar menú"
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
            <SidebarContent onNavigate={() => setMobileOpen(false)} />
          </div>
        </div>
      )}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-surface px-4 py-3 lg:hidden">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-2 rounded-lg hover:bg-surface-muted cursor-pointer"
            aria-label="Abrir menú"
          >
            <Bars3Icon className="h-6 w-6" />
          </button>
          <span className="font-semibold text-ink">field-check</span>
        </header>

        <main className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
