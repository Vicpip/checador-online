# CLAUDE.md — field-check

This file is the fast-resume entry point for future sessions. Read this first, then
`CONTEXT_CHECADOR.md` (one level up, at `../CONTEXT_CHECADOR.md`) for the full data
model/API/customization spec this codebase was built against — it is the source of truth.

## What this project is

Open source, self-hosted workforce check-in system. Workers check in/out (photo + GPS) at a job
site; managers get a dashboard with attendance reports and a job-assignment calendar. No mid-day
tracking, no surveillance — just start-of-day and end-of-day. Every visible name/label/color is
meant to be customized per deployment (see "Branding" below) — this is designed as a reusable
open-source template, not a single-tenant app.

## Stack

- **Backend**: Python 3.11, FastAPI, SQLAlchemy 2.x (Mapped/mapped_column style), Alembic,
  Pydantic v2, JWT (python-jose) + bcrypt (passlib).
- **DB**: PostgreSQL (via `psycopg2-binary`).
- **Admin frontend**: React 18 + Vite + Tailwind + FullCalendar + Heroicons + axios + Leaflet.js
  (`leaflet` + `react-leaflet`) with OpenStreetMap tiles for the check-in/check-out location map
  (no API key needed).
- **Worker PWA**: React 18 + Vite + Tailwind + vite-plugin-pwa + Heroicons + axios.
- **Infra**: docker-compose (postgres + backend/uvicorn + nginx). nginx listens on two ports so the
  admin dashboard and worker PWA are served from **separate origins** — `http://localhost:8080` for
  the admin dashboard (`/` and `/admin/`, same build, two prefixes) and `http://localhost:8081` for
  the worker PWA (`/`). Each port's server block reverse-proxies its own `/api/*` to the backend.
  Separate origins means separate service-worker scopes — this is deliberate: when both apps lived
  on one origin, the admin SW could intercept PWA navigations (and vice versa), which caused a
  logged-in PWA user to get redirected to the admin dashboard on refresh. See "Hard rules" below.

## Repo layout

```
field-check/
├── backend/                FastAPI app — main.py, database.py, models.py, schemas.py,
│                           dependencies.py, settings.py, create_admin.py (bootstrap script)
│   ├── routers/            auth, jornadas, servicios, admin, config, fotos
│   ├── utils/              fotos.py (photo/logo storage), geo.py, puntualidad.py, security.py
│   └── alembic/versions/   0001 initial (5 tables + seeded config), 0002 TIMESTAMPTZ columns,
│                           0003 servicios.hora, 0004 config working-hours columns,
│                           0005 horarios table (per-técnico expected weekly schedule),
│                           0006 ausencias table (absences / time-off), 0007 ausencias approval
│                           workflow (estatus/respuesta_notas/respondida_por)
├── frontend/
│   ├── admin/src/          pages/ (Dashboard, Jornadas, Reportes, Calendario, Usuarios,
│   │                       Clientes, Configuracion, Login), components/ (EditarPerfilModal,
│   │                       AusenciasCalendario, MapaModal, EstadoJornadaBadge, PhotoModal,
│   │                       Badge, StatCard, …),
│   │                       context/ (Auth, Config), api/client.js
│   └── pwa/src/            pages/ (Login, Jornada, MisServicios), components/ (CamaraCheckin,
│                           EstadoJornada), hooks/useGeolocation.js, utils/comprimirFoto.js
├── nginx/                  Dockerfile (multi-stage: builds both frontends) + nginx.conf
├── docker-compose.yml, .env.example, README.md, LICENSE (MIT)
```

## Status: fully built (1.0), plus post-1.0 additions (see "Features added post-1.0" below)

Every endpoint in `CONTEXT_CHECADOR.md` is implemented, plus the branding endpoints the user
requested on top of the spec, plus employee weekly schedules / jornada hours analysis / the
check-in location map / absences & time-off management documented below. Both frontends are
complete and **build cleanly** (`npm run build` verified for both `frontend/admin` and
`frontend/pwa` — 0 errors; re-verified for `frontend/admin` after adding `leaflet`/`react-leaflet`,
again after adding the absences feature, and again after wiring absences into Reportes' row
coloring, Calendario, and Dashboard — see feature 5 below). Backend
verified with `python -m py_compile` on every file (full `pip install` wasn't run locally — this
machine has Python 3.14, which pydantic-core/psycopg2 don't yet ship wheels for; the Docker image
pins `python:3.11-slim`, which is the actually-supported target and should install cleanly there —
this has not been runtime-tested end-to-end in a container, only build/syntax-verified).

### What's built
- [x] Backend: models, schemas, dependencies, all routers, main.py
- [x] Alembic initial migration (usuarios, jornadas, clientes, servicios, config) with seeded
      branding defaults (`field-check` / `#1F5FA5` / `#1D9E75` / `#F59E0B`)
- [x] `create_admin.py` bootstrap script (no signup endpoint by design — first admin needs this)
- [x] Branding: `GET /config` (public), `PUT /admin/config`, `POST /admin/config/logo`
- [x] `.env.example`, `docker-compose.yml`, `backend/Dockerfile`, `nginx/Dockerfile` + `nginx.conf`
- [x] Admin dashboard: all 7 pages + Layout/Sidebar, live branding theming via ConfigContext
- [x] Worker PWA: Login, Jornada (check-in/out), MisServicios, camera capture, geolocation hook,
      photo compression, offline-friendly cached jornada state (sessionStorage)
- [x] README.md (English, self-hosting + branding instructions)

### What's NOT built / known gaps (be aware before extending)
- **No automated tests** (no pytest suite, no frontend component tests). Nothing was asked for
  this in the brief, but there is zero test coverage today — worth flagging if this goes to
  production.
- **No background job** to flip stale `activa` jornadas to `sin_salida` (e.g. a worker who forgets
  to check out). The status enum supports it (`estatus IN ('activa','completa','sin_salida')`) but
  nothing sets it yet — would need a scheduled task (cron / APScheduler) calling something like
  "any jornada from a past date still `activa` → `sin_salida`".
  Currently a "sin_salida" jornada can only be observed in the DB, never generated.
- **Never run against a real Postgres instance** — migrations and endpoints are correct per SQLAlchemy/Alembic API surface and manually reviewed, but `docker compose up` has not actually been
  executed in this environment (no Docker available here). First real run should be treated as a
  smoke test, not an afterthought.
- **PWA icons are 1×1 placeholder PNGs** (`frontend/pwa/public/icons/icon-{192,512}.png`) — the
  manifest requires build-time static icons (unlike in-app branding, which is applied at runtime),
  so these need to be replaced with real artwork per deployment. Documented as a known limitation,
  not fixed here since it needs real image assets.
- **No rate limiting / brute-force protection** on `/auth/login`.
- Admin/worker frontends have no automated a11y or visual regression testing — reviewed manually
  against the ui-ux-pro-max checklist (contrast, touch targets, focus rings, reduced-motion) but
  not machine-verified.

## Design system

Generated via `.claude/skills/ui-ux-pro-max/scripts/search.py --design-system` with the query
`"saas admin dashboard operations tool professional clean minimal"` (a first pass with
`"field service management dashboard workforce attendance"` returned an off-fit vibrant/newsletter
pattern, so the query was refined). Result: Inter typeface, navy/professional + green palette —
close enough to the spec's seeded config colors (`#1F5FA5` primary / `#1D9E75` secondary /
`#F59E0B` accent) that those exact values were kept as-is per the brief, with the rest of the
generated system (neutrals, spacing rhythm, focus rings, elevation) used as the base language.

All three brand colors are **CSS custom properties** (`--color-primary` / `--color-secondary` /
`--color-accent`, plus derived `-fg` contrast variants) set on `:root` at runtime by
`ConfigContext` in both frontends after `GET /config` resolves. Tailwind's `primary`/`secondary`/
`accent` color tokens (see `tailwind.config.js` in each frontend) just wrap those variables — never
hardcode a hex value in a component.

## Features added post-1.0 (2026-08-01)

### 1. Employee profiles with weekly schedule
- New `horarios` table (migration `0005`, model `Horario` in `models.py`): one row per
  (`tecnico_id`, `dia_semana`), `dia_semana` SMALLINT following **Python's `date.weekday()`
  convention** (0=Lunes … 6=Domingo) on purpose — the reportes endpoint looks a row up with
  `jornada.fecha.weekday()` directly, no remapping table needed. `hora_inicio` / `hora_fin` are
  plain `TIME` (wall-clock, business-timezone — same convention as `config.hora_inicio_jornada`).
  `activo` marks whether that weekday is currently a workday (not whether the row exists).
- Endpoints (`routers/admin.py`): `GET/PUT /admin/usuarios/{id}/horarios`. The `PUT` is a **full
  replace** — it deletes all of that técnico's `horarios` rows and re-inserts whatever list is
  posted. `PATCH /admin/usuarios/{id}` now takes a JSON body (`UsuarioUpdate`: nombre/email/activo,
  all optional) instead of the old `activo` query param — the frontend's `toggleActivo` call in
  `Usuarios.jsx` was updated to match.
- Admin UI: `components/EditarPerfilModal.jsx`, opened via "Editar perfil" per row in
  `pages/Usuarios.jsx`. Edits nombre/email/activo and a Mon–Sat schedule grid (checkbox + start/end
  time per day). Sunday is intentionally not editable in this UI (no row is ever created for
  `dia_semana=6`) — the table itself has no such restriction, so this is a UI-level choice, not a
  DB one, if a future deployment needs 7-day scheduling.

### 2. Jornada analysis — hours summary
- `utils/puntualidad.py::analizar_jornada()` is the single place that compares one jornada's
  actual check-in/out against the técnico's expected schedule for that weekday. It returns
  `horas_esperadas` (duration of the `horario` row, or `None` if no active `horario` exists for
  that weekday — a técnico with no schedule configured gets blank comparison fields, not zeros),
  `horas_extra` (`max(0, horas_trabajadas - horas_esperadas)`), `entro_antes`, `salio_despues`,
  `salio_antes` (all `None` when there's no applicable `horario`), and `puntual` — which reuses the
  existing `es_puntual()` against the **global** `config.hora_limite_entrada`, not the per-worker
  `horario.hora_inicio` (these are deliberately different concepts: punctuality is a company-wide
  cutoff, "entró antes/salió antes/después" is relative to that worker's own scheduled shift).
- `GET /admin/reportes` response (`schemas.ReporteOut`) now also carries `horas_esperadas_totales`,
  `horas_extra_totales`, and `dias_puntuales`, and each item in `jornadas` is a `JornadaAnalisis`
  (adds `dia_semana` + the fields above on top of `JornadaOut`).
- Admin UI: `pages/Reportes.jsx` shows a stat row (horas trabajadas/esperadas, horas extra, días
  puntuales/trabajados, puntualidad %) and a per-jornada table with an `EstadoJornadaBadge`
  (`components/EstadoJornadaBadge.jsx`) — green ("A tiempo") when punctual and within the
  scheduled window, yellow when early/late (`!puntual`, `salio_antes`, `salio_despues`), red when
  the jornada has no checkout or `horas_trabajadas < horas_esperadas`.

### 3. Check-in location map
- `components/MapaModal.jsx` — Leaflet + OpenStreetMap tiles (`{s}.tile.openstreetmap.org`, no API
  key). Green marker = check-in (`entrada_lat/lng`), red marker = check-out (`salida_lat/lng`, only
  if present), dashed line connecting both when both exist. Popups show time (via
  `formatFechaHora`), coordinates, and `precision_m` — this is the **one place** `precision_m` is
  actually surfaced to an admin; it's still never used to accept/reject a check-in (hard rule 5
  below still holds).
  Markers are plain `L.divIcon` colored circles (no external marker image assets needed, avoids the
  classic Leaflet+bundler broken-default-icon issue).
  Opened via a map-pin icon button per row in `pages/Jornadas.jsx` (new "Ubicación" column) — no
  new backend endpoint needed since `entrada_lat/lng/precision_m` and `salida_lat/lng/precision_m`
  were already returned by `GET /admin/jornadas`.
- `leaflet` + `react-leaflet` (v4, React 18-compatible) were added to `frontend/admin/package.json`
  by this feature — they were not previously a dependency. "No API key needed" (OpenStreetMap tiles
  are free/unauthenticated) is a different claim from "already installed"; don't conflate the two
  if extending this further.

### 4. Absences / time-off management (added 2026-08-03)
- New `ausencias` table (migration `0006`, model `Ausencia` in `models.py`): one row per
  (`tecnico_id`, `fecha`), `tipo` CHECK-constrained to `falta | vacaciones | permiso_con_goce |
  permiso_sin_goce | incapacidad`, plus `notas` (free text) and `creado_por` (the admin who
  registered it). `jornadas` and `ausencias` are intentionally never both present for the same
  técnico/fecha — same decoupling instinct as `jornadas`/`servicios`, but here it's enforced, not
  just conventional: `POST /admin/ausencias` (`routers/admin.py::crear_ausencia`) returns 409 if a
  `jornada` already exists for that técnico/fecha, and again 409 if an `ausencia` already does
  (`UNIQUE(tecnico_id, fecha)` backs the second check). `DELETE /admin/ausencias/{id}` and
  `GET /admin/ausencias?tecnico_id=&fecha_inicio=&fecha_fin=` round out the CRUD.
- **`falta_injustificada` detection** (`routers/admin.py::reporte_tecnico`): for each calendar day
  in the reportes range, a day only counts as an unjustified falta if the técnico has an **active
  `horario`** for that weekday (i.e. it's expected to be a workday per their own schedule — see
  post-1.0 feature 1) *and* there's no `jornada` *and* no `ausencia` on it. A técnico with no
  `horario` configured for a weekday (or no schedule at all) never gets flagged for that day — this
  deliberately reuses the same "no horario ⇒ no basis for comparison" rule that already governs
  `horas_esperadas` being `None`, rather than hardcoding a Mon–Fri assumption that would ignore
  custom (e.g. Saturday-only) schedules. `GET /admin/reportes` now also returns `ausencias` (the
  raw records in range), `fechas_falta_injustificada` (the computed date list), and
  `dias_faltados` / `dias_vacaciones` / `dias_permiso` / `dias_incapacidad` summary counts —
  `dias_faltados` counts only the auto-detected empty days, not `ausencia` rows with `tipo='falta'`
  (an admin-recorded falta is, definitionally, no longer *unjustified* once it's on record — it
  just doesn't roll up into any of the four summary buckets beyond appearing in `ausencias`).
- `GET /admin/reportes/export/csv` gained `Tipo` (`Jornada` / the `AUSENCIA_TIPO_LABELS` value /
  `Falta injustificada`) and `Notas` columns, with one row per jornada, ausencia, and detected
  unjustified-falta day, chronologically merged. Unlike `/admin/reportes` (which requires a single
  `tecnico_id`), this endpoint's `tecnico_id` is optional — when omitted, the falta-detection loop
  runs per técnico (`rol='tecnico'`) using each one's own `horarios`, not a single shared schedule.
- Admin UI: `components/AusenciasCalendario.jsx`, embedded in `EditarPerfilModal.jsx` under a new
  "Ausencias" section (below the weekly-schedule grid). Renders one month at a time as a 7-column
  grid (Lun–Dom, Python `weekday()` order to match `horarios.dia_semana`) fetching that técnico's
  `/admin/jornadas` + `/admin/ausencias` for the visible month. Cell color: green = jornada
  completa, yellow = jornada sin `salida_hora`, red = falta injustificada (workday, no record, not
  in the future), blue = ausencia registrada, gray = not a scheduled workday or a future date.
  Clicking a day with no jornada and no ausencia (red or gray) opens a small form to pick `tipo` +
  optional `notas` and `POST`s it; clicking a blue (ausencia) day opens a view/delete popover
  (`DELETE /admin/ausencias/{id}`) — this delete affordance isn't explicitly spec'd but was added
  since the backend endpoint would otherwise have no UI path. Days with a jornada aren't clickable.
  The brief's two UI options for this were "a button per Jornadas-page row gap" vs. "better: a
  calendar in the Editar perfil modal" — only the second (explicitly called out as preferred) was
  built; there is no "Agregar ausencia" button on `pages/Jornadas.jsx`.
- `pages/Reportes.jsx`: added a second stat-card row (`Faltas injustificadas` / `Vacaciones` /
  `Permisos` / `Incapacidad`, from the new `ReporteOut` counts) and replaced the jornadas-only table
  with one merged, chronologically-sorted table over jornadas + ausencias + detected unjustified
  faltas, each row tinted by category (`FILA_TONO_CLASES` in `Reportes.jsx`: light secondary for
  jornadas, light blue for ausencias, light danger for unjustified faltas) so the three categories
  are visually distinguishable at a glance, per the brief. `StatCard` gained two tone variants
  (`danger`, `info`) to support this — `info` is a plain Tailwind blue, not a CSS-variable brand
  token, since it's a fixed status color (matches the "blue = ausencia" convention in the calendar
  above), not something a deployment should be able to re-brand.

### 5. Absences — full frontend integration (Reportes/Usuarios fixes, Calendario, Dashboard) (2026-08-03)
- `pages/Reportes.jsx`: the merged jornadas+ausencias+faltas table and the second stat-card row
  (`Faltas injustificadas`/`Vacaciones`/`Permisos`/`Incapacidad`) already existed from feature 4
  above; the one real gap was that every jornada row shared one color regardless of how the jornada
  actually went. `tonoJornada()` now buckets each jornada into `jornadaCompleta` (green,
  `bg-secondary/5`) or `jornadaCorta` (yellow, `bg-accent/5`, no `salida_hora` or
  `horas_trabajadas < horas_esperadas`) — deliberately a coarser 2-way split than
  `EstadoJornadaBadge`'s 4-state `evaluar()` (which still drives the finer-grained Estado badge in
  the same row): "llegó tarde"/"salió antes"/"salió después" don't change row color, only
  completeness does, per the brief's green/yellow split.
- `components/AusenciasCalendario.jsx` / `components/EditarPerfilModal.jsx`: the calendar was
  already wired into "Editar perfil" and functionally worked, but had two rough edges fixed here:
  (1) the section heading is now literally "Gestión de ausencias" (was "Ausencias"); (2)
  `AUSENCIA_LABELS.falta` is now "Falta justificada" (was "Falta") — clearer in the tipo dropdown
  and everywhere else this shared label map is consumed (Reportes, Dashboard, Calendario). Also:
  `FormularioAusencia`'s inline "register an ausencia" popover was a real `<form>` nested inside
  `EditarPerfilModal`'s outer `<form>` — invalid HTML (nested forms), fixed by converting it to a
  plain `<div>` with an `onClick`-driven submit button instead of `type="submit"`.
- `components/AusenciaModal.jsx` (new) + `pages/Calendario.jsx`: added a "+ Registrar ausencia"
  button next to "+ Nuevo servicio" that opens a técnico/tipo/fecha(+fecha opcional "hasta" for
  vacaciones)/notas form. Since `ausencias` is one row per (tecnico_id, fecha) with no range concept
  server-side, a "Desde/Hasta" vacaciones range is submitted as one `POST /admin/ausencias` per day
  in the range (`handleSaveAusencia` in `Calendario.jsx`) — not a new bulk endpoint.
  FullCalendar events are now merged from three sources per visible range: `/admin/servicios`
  (unchanged), `/admin/ausencias` (tinted per `tipo`: vacaciones blue `#3b82f6`, both permiso types
  purple `#a855f7`, incapacidad orange `#f97316`, falta `var(--color-danger)`), and the new
  `/admin/ausencias/faltas-injustificadas` (below) for auto-detected red events. Every event carries
  `extendedProps.kind` (`servicio`/`ausencia`/`falta`) so `eventClick` can dispatch correctly:
  `servicio` opens `ServicioModal`, `ausencia` prompts `window.confirm` + `DELETE
  /admin/ausencias/{id}`, `falta` is inert (nothing to edit — it's computed, not a row).
- `pages/Dashboard.jsx`: new "Ausencias hoy" card below the existing 4 `StatCard`s — lists técnicos
  with an ausencia today whose `tipo` is `vacaciones`/`permiso_con_goce`/`permiso_sin_goce`/
  `incapacidad` (deliberately excludes `tipo='falta'` — a justified-after-the-fact falta isn't "time
  off" in the sense this widget is describing). Falls back to "Todos los {worker_role_label}s
  disponibles hoy." when the filtered list is empty. Técnico names are resolved client-side from the
  already-fetched `/admin/tecnicos` list since `AusenciaOut` only carries `tecnico_id`.
- **New backend endpoint**: `GET /admin/ausencias/faltas-injustificadas?fecha_inicio=&fecha_fin=&tecnico_id=`
  (`routers/admin.py`, schema `FaltaInjustificadaOut`) — the only piece of this feature that needed a
  backend change. Calendario needs auto-detected unjustified-falta events across *all* técnicos for
  a visible month, which nothing previously exposed (`/admin/reportes` is single-técnico;
  `/admin/reportes/export/csv` computes the multi-técnico version inline but only as CSV rows). The
  shared computation was extracted into `_calcular_faltas_injustificadas()` (same
  horarios/jornadas/ausencias rule as `reporte_tecnico`, generalized to many técnicos) and the CSV
  export now calls it too instead of duplicating the loop. One behavior change from the extraction:
  the helper caps its scan at `min(fecha_fin, hoy)` — a future date can never be an unjustified
  falta — which the CSV export's inline loop didn't previously guard against (harmless there in
  practice since CSV exports are rarely run for future ranges, but load-bearing for Calendario, whose
  visible month routinely includes future days). `reporte_tecnico`'s own single-técnico loop was
  intentionally left as-is (not extracted) to avoid changing Reportes.jsx behavior outside this ask.

### 6. Ausencia approval workflow — técnico self-requests (2026-08-03)
- Migration `0007` adds `estatus` (`pendiente|aprobada|rechazada`, default `'aprobada'`),
  `respuesta_notas` (nullable text), and `respondida_por` (nullable FK to `usuarios`) to
  `ausencias`. The default keeps every pre-existing (admin-created) row — and every future
  admin-created row — landing as `'aprobada'` with no review step; only the técnico self-request
  path opts into `'pendiente'`.
- `POST /jornadas/ausencias` (`routers/jornadas.py::solicitar_permiso`, already existed pre-this-
  feature) now explicitly sets `estatus="pendiente"` on creation. `POST /admin/ausencias`
  (`routers/admin.py::crear_ausencia`) explicitly sets `estatus="aprobada"` — admin-registered
  absences still skip review, matching pre-existing behavior.
- New `GET /jornadas/ausencias` (`routers/jornadas.py::mis_ausencias`) — the authenticated
  técnico's own ausencia rows (any estatus), newest-`fecha`-first. Powers the PWA's
  `pages/MisPermisos.jsx`.
- New `PATCH /admin/ausencias/{id}/responder` (`routers/admin.py::responder_ausencia`, schema
  `AusenciaResponder`) — admin-only, sets `estatus` (`aprobada|rechazada`), optional
  `respuesta_notas`, and `respondida_por` (the responding admin). No `estatus` guard on the
  current row value — an admin can re-respond to flip a decision, by design (kept simple; add a
  `pendiente`-only check here if that turns out to be undesired).
- `GET /admin/ausencias` (`routers/admin.py::listar_ausencias`) gained an optional `estatus`
  query filter (`tecnico_id`/`fecha_inicio`/`fecha_fin` were already there) — used by the admin
  Dashboard to separately fetch today's *approved* ausencias (for the pre-existing "sin registro
  hoy" section) and *all pending* ones (for the new section below), without polluting either
  with the other's rows.
- Admin UI: `pages/Dashboard.jsx` gained a "Solicitudes pendientes" section (above "{worker}s sin
  registro hoy") listing every `estatus='pendiente'` ausencia with Aprobar/Rechazar buttons.
  Both open `components/ResponderAusenciaModal.jsx` (new) — a small confirmation dialog with an
  optional note — which calls the new PATCH endpoint and refreshes the dashboard. The pre-existing
  "sin registro hoy" ausencia lookup (`ausenciasHoy`) was narrowed to `estatus=aprobada` only, so a
  técnico's still-pending or already-rejected self-request no longer shows there as if it were a
  settled absence.
  **Known gap**: `components/AusenciasCalendario.jsx`, `pages/Calendario.jsx`, and the reportes
  endpoints (`GET /admin/reportes`, `/admin/reportes/export/csv`,
  `_calcular_faltas_injustificadas`) still query `Ausencia` rows with no `estatus` filter — a
  técnico's `pendiente` or `rechazada` self-request will still render/count there as if settled.
  Left as-is deliberately (Reportes/Calendario were out of scope for this change) — worth
  revisiting if self-service requests see real usage.
- PWA UI: `pages/MisPermisos.jsx` (new) — the técnico's own permiso history, one card per ausencia
  with a status badge (pendiente=yellow, aprobada=green, rechazada=red, same convention as
  `components/EstadoJornadaBadge`/`Badge` elsewhere) and `respuesta_notas` shown when present. The
  "Solicitar permiso"/"Nueva solicitud" entry point moved here from `pages/Jornada.jsx` (which no
  longer links to `/solicitar-permiso` directly). `components/Layout.jsx`'s bottom nav grew from 3
  to 4 tabs (`grid-cols-3` → `grid-cols-4`) to add "Mis permisos"
  (`ClipboardDocumentCheckIcon`) alongside Jornada/Mis servicios/Mis jornadas.

## Hard rules (do not violate these — see CONTEXT_CHECADOR.md for the full rationale)

1. `jornadas` and `servicios` have **no FK between them**. Keep them decoupled.
2. Photos and the logo are **never served by a direct/static path**. `GET /fotos/{path}` validates
   a JWT first (and restricts técnicos to their own photos). The logo has no fetchable URL at
   all — `GET /config` embeds it as a base64 data URI, which also solves "show the logo before
   login" without breaking the "authenticated endpoint only" spirit of the rule.
3. Role labels / entity names in the UI come from env vars (`WORKER_ROLE_LABEL`,
   `ADMIN_ROLE_LABEL`) or the `config` DB table (company name/colors/logo) — never hardcoded.
4. The PWA's geolocation (`src/hooks/useGeolocation.js`) always rejects with a clear, user-facing
   message on permission-denied/unavailable/timeout — never fails silently.
5. `precision_m` is stored (both check-in and check-out) but **never read** to accept/reject a
   check-in anywhere in `routers/jornadas.py`. It's informational only.

## Extension points already wired for reuse

- Swap photo/logo storage backend (S3, R2, etc.) → reimplement 4 functions in
  `backend/utils/fotos.py` (`save_photo`, `get_photo_path`, `save_logo`, `get_logo_path`). Every
  router already goes through these.
- Add a role beyond admin/tecnico → extend the CHECK constraint in the Alembic migration +
  `backend/dependencies.py` (`require_<role>`) + frontend labels.
- Swap DB engine → change `DATABASE_URL` + Alembic dialect.

## A few implementation notes worth knowing before touching this

- `GET /admin/servicios` (listing with filters) and `PATCH /admin/usuarios/{id}` (toggle `activo`)
  are **not** in the literal `CONTEXT_CHECADOR.md` endpoint list — they were added because the
  Calendario and Usuarios admin pages can't function without them. Documented here so nobody
  "fixes" them away as spec drift.
- Also not in the literal spec, added post-1.0: `GET /admin/reportes/export/csv` (CSV export for
  Reportes, same filters as `/admin/reportes`), `servicios.hora` (optional time-of-day on a
  service, migration `0003`), and `config.hora_inicio_jornada` / `config.hora_limite_entrada`
  (admin-editable working hours, migration `0004`, nullable — NULL falls back to
  `HORA_INICIO_JORNADA` / `HORA_LIMITE_ENTRADA` env vars, resolved in `routers/config.py::_to_out`).
- **Timestamps are always stored as UTC.** `jornadas.entrada_hora` / `salida_hora`,
  `usuarios.creado_en`, and `config.actualizado_en` are `TIMESTAMPTZ` (migration `0002`) written via
  `datetime.now(timezone.utc)` — never a naive `datetime.now()`/`utcnow()`. Both frontends convert
  to `America/Mexico_City` for display via each `src/utils/formato.js` (explicit `timeZone:` in
  `Intl`/`toLocaleString`, not reliant on the viewer's browser timezone — this is a fixed-locale
  deployment). `date.today()` calls (jornada/servicio business-day boundaries) rely on the
  container's `TZ` env var (`docker-compose.yml`, default `America/Mexico_City`) being correct —
  `backend/Dockerfile` installs `tzdata` for this. Punctuality (`utils/puntualidad.py`) converts
  `entrada_hora` back to `settings.business_timezone` before comparing wall-clock time — comparing
  raw UTC `.time()` against a Mexico City cutoff would silently be wrong.
- Admin dashboard is served at both nginx paths `/` and `/admin/` (same build, two prefixes) on
  port 8080 — React Router basename is picked at runtime from `window.location.pathname` (`/admin`
  if the URL starts with it, `/` otherwise; always `/` in dev). Vite `base` is fixed to `/admin/`
  in production so built asset URLs (`/admin/assets/...`) resolve the same regardless of which
  prefix loaded the page. This specifically doesn't collide with the `/admin/*` **API** routes,
  which are reverse-proxied under `/api/admin/*` instead. The worker PWA is served at `/` on its
  own port (8081) — its Vite `base` and React Router `basename` are both plain `/`, and every
  hardcoded PWA login redirect (`api/client.js`, `ProtectedRoute.jsx`, `AuthContext.jsx`) is
  `/login`, not `/pwa/login`. If you ever change the nginx routing, keep these in sync:
  `nginx/nginx.conf` (two `server` blocks, one per port), `nginx/Dockerfile` (copies each
  frontend's `dist/` to its own subfolder, still `html/pwa/` and `html/admin/`), each frontend's
  `vite.config.js` `base`, and each frontend's `src/main.jsx` router `basename`.
- **Admin: `http://localhost:8080`. Worker PWA: `http://localhost:8081`.** They are separate
  origins by design (see "Stack" above) — never reintroduce a shared-origin path prefix scheme for
  the PWA, since that's what caused the service-worker navigation-hijack bug this split fixed.
- Both frontends' `api/client.js` read `VITE_API_URL` — defaults to `http://localhost:8000` for
  local dev against uvicorn directly; set to `/api` for the docker-compose/nginx setup.
