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
│                           0005 horarios table (per-técnico expected weekly schedule)
├── frontend/
│   ├── admin/src/          pages/ (Dashboard, Jornadas, Reportes, Calendario, Usuarios,
│   │                       Clientes, Configuracion, Login), components/ (EditarPerfilModal,
│   │                       MapaModal, EstadoJornadaBadge, PhotoModal, Badge, StatCard, …),
│   │                       context/ (Auth, Config), api/client.js
│   └── pwa/src/            pages/ (Login, Jornada, MisServicios), components/ (CamaraCheckin,
│                           EstadoJornada), hooks/useGeolocation.js, utils/comprimirFoto.js
├── nginx/                  Dockerfile (multi-stage: builds both frontends) + nginx.conf
├── docker-compose.yml, .env.example, README.md, LICENSE (MIT)
```

## Status: fully built (1.0), plus post-1.0 additions (see "Features added post-1.0" below)

Every endpoint in `CONTEXT_CHECADOR.md` is implemented, plus the branding endpoints the user
requested on top of the spec, plus employee weekly schedules / jornada hours analysis / the
check-in location map documented below. Both frontends are complete and **build cleanly**
(`npm run build` verified for both `frontend/admin` and `frontend/pwa` — 0 errors; re-verified for
`frontend/admin` after adding `leaflet`/`react-leaflet`). Backend
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
