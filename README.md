# field-check

Open source, self-hosted workforce check-in system for teams whose workers start their day
directly at a job site instead of an office. Workers check in at the start of the day (photo +
GPS) and check out at the end. Managers get a dashboard with attendance reports and a calendar to
assign jobs.

**What it deliberately does NOT do:** track workers during the day, verify presence at specific
locations, or log every movement. Just start-of-day and end-of-day — no surveillance. GPS accuracy
(`precision_m`) is recorded for the manager's context only and is never used to accept or reject a
check-in.

> Every name, label, role, and color in this project is meant to be changed. It ships with
> sensible defaults — brand it for your own organization in a few minutes, no code changes needed.

## What's in the box

- **Backend** — FastAPI + SQLAlchemy 2.x + Alembic + PostgreSQL, JWT auth.
- **Admin dashboard** — React + Vite + Tailwind + FullCalendar. Attendance, reports, scheduling,
  users, clients, and a branding/Configuración page.
- **Worker PWA** — React + Vite + Tailwind, installable on a phone home screen. Check-in/check-out
  with camera + GPS, and a read-only view of assigned jobs.
- **nginx** — reverse proxy for the API and static host for both frontends.

## Architecture

```
field-check/
├── backend/            FastAPI app (see backend/README below inline)
├── frontend/
│   ├── admin/          Manager dashboard (React)
│   └── pwa/            Worker check-in app (React PWA)
├── nginx/               Reverse proxy + static hosting config
├── docker-compose.yml
├── .env.example
└── CONTEXT_CHECADOR.md  Full data model / API contract (source of truth for this repo)
```

`jornadas` (attendance) and `servicios` (scheduling) are **intentionally decoupled** — there is no
foreign key between them. They are separate concerns by design; do not add one.

## Self-hosting with Docker (recommended)

Requirements: Docker + Docker Compose.

```bash
git clone <this-repo>
cd field-check
cp .env.example .env
# edit .env — at minimum set SECRET_KEY to a random 32+ character string

docker compose up -d --build
```

This starts three services:

| Service | What it does |
|---|---|
| `postgres` | Database, with a named volume for persistence |
| `backend` | Runs `alembic upgrade head` then `uvicorn`, creating the schema and seeding the default branding row on first boot |
| `nginx` | Serves the admin dashboard on port 8080 and the worker PWA on port 8081 (separate origins, each proxying `/api/*` to the backend) |

Once it's up, open `http://localhost:8080/` (or `http://localhost:8080/admin/`) for the dashboard
and `http://localhost:8081/` for the worker app. The two apps are served on different ports
(different origins) on purpose, so their service workers can never intercept each other's
navigations.

### Create the first admin user

There is no public signup — admins create every account from the dashboard, but you need one admin
to log in with first. Run this once, inside the backend container:

```bash
docker compose exec backend python create_admin.py \
  --nombre "Jane Doe" --email jane@company.com --password "change-me-immediately"
```

Log in at `/admin/` with that email/password, then create the rest of your team (workers and any
other admins) from the **Usuarios** page.

## Running locally without Docker

**Backend**

```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp ../.env.example ../.env   # edit DATABASE_URL to point at your local Postgres
alembic upgrade head
python create_admin.py --nombre "Jane Doe" --email jane@company.com --password "change-me"
uvicorn main:app --reload
```

**Admin dashboard**

```bash
cd frontend/admin
cp .env.example .env   # VITE_API_URL=http://localhost:8000
npm install
npm run dev             # http://localhost:5174
```

**Worker PWA**

```bash
cd frontend/pwa
cp .env.example .env   # VITE_API_URL=http://localhost:8000
npm install
npm run dev             # http://localhost:5173
```

## Branding your deployment (no code changes)

Company name, logo, and colors are stored in the database (the `config` table), not in code, and
are fetched by both frontends on load via `GET /config`. To brand a deployment:

1. Log into the admin dashboard as an admin.
2. Go to **Configuración**.
3. Upload your logo (PNG, JPG, SVG, or WebP, max 2MB) — you'll see a live preview before saving.
4. Pick your primary, secondary, and accent colors with the color pickers (or type hex values) —
   the preview panel updates live as you pick.
5. Set your company name.
6. Click **Guardar cambios**.

Both the admin dashboard and the worker PWA re-theme immediately (they apply the colors as CSS
custom properties on `:root`) — no rebuild or redeploy required. The logo is never exposed as a
static file path; it's embedded as a data URI inside the `GET /config` response, so there's nothing
to misconfigure or accidentally expose.

Two labels are **not** in the database — they're env vars, because changing them usually means
adjusting other copy in your own fork too:

| Label | Env var | Default |
|---|---|---|
| What a field worker is called | `WORKER_ROLE_LABEL` | `Técnico` (try "Driver", "Agent", "Rep", "Field Tech"…) |
| What a manager is called | `ADMIN_ROLE_LABEL` | `Administrador` (try "Supervisor", "Dispatcher", "Manager"…) |

Restart the backend after changing those two.

## Environment variables

All variables are documented in [`.env.example`](.env.example). Summary:

| Variable | Purpose | Default |
|---|---|---|
| `DATABASE_URL` | Postgres connection string | — |
| `SECRET_KEY` | JWT signing secret — **change this** | — |
| `ALGORITHM` | JWT algorithm | `HS256` |
| `ACCESS_TOKEN_EXPIRE_HOURS` | JWT lifetime | `8` |
| `APP_NAME` | Fallback app name (title bar before `/config` loads) | `field-check` |
| `WORKER_ROLE_LABEL` | Worker role label shown in the UI | `Técnico` |
| `ADMIN_ROLE_LABEL` | Manager role label shown in the UI | `Administrador` |
| `TZ` | Business/OS timezone for the backend and postgres containers (business-day boundaries; DB timestamps are always stored as UTC and both frontends always render in `America/Mexico_City`) | `America/Mexico_City` |
| `HORA_INICIO_JORNADA` | Fallback nominal start-of-day time (`HH:MM`) — overridden by Configuración once an admin sets it | `08:00` |
| `HORA_LIMITE_ENTRADA` | Fallback check-in cutoff time for the punctuality metric (`HH:MM`) — overridden by Configuración once an admin sets it | `08:00` |
| `FOTOS_BASE_PATH` | Disk path where check-in/out photos are stored | `/var/fieldcheck/fotos` |
| `LOGO_BASE_PATH` | Disk path where the uploaded logo is stored | `/var/fieldcheck/logo` |
| `FOTO_MAX_WIDTH` | Client-side compression target width (px) | `1200` |
| `FOTO_QUALITY` | Client-side JPEG quality (0–1) | `0.75` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:5173,http://localhost:5174` |
| `VITE_API_URL` (per-frontend `.env`) | Where the frontend finds the API | `http://localhost:8000` (dev) / `/api` (docker-compose) |

## API contract

See [`CONTEXT_CHECADOR.md`](CONTEXT_CHECADOR.md) for the full data model and endpoint list — it is
the source of truth this codebase was built against. Interactive API docs are also available at
`/docs` (Swagger UI) once the backend is running.

## Hard rules this codebase follows

- `jornadas` and `servicios` stay decoupled — no foreign key between them.
- Photos and the logo are **never** served by a direct/static file path — always through an
  endpoint the backend controls (`GET /fotos/{path}` validates a JWT first; the logo is embedded as
  a data URI inside the public `GET /config` response, so there is no fetchable logo URL at all).
- Role labels and entity names visible in the UI come from env vars or the `config` table, never
  hardcoded strings — this is what makes the project reusable outside of field services.
- The worker PWA's geolocation fails **loudly and clearly** if permission is denied or unavailable
  — never silently.
- `precision_m` is stored for the manager's context but never used to accept or reject a check-in.

## Swapping parts of the stack

- **Database**: change `DATABASE_URL` and the Alembic dialect to swap PostgreSQL for MySQL/SQLite.
- **Photo/logo storage**: reimplement `save_photo` / `get_photo_path` / `save_logo` /
  `get_logo_path` in `backend/utils/fotos.py` to swap local disk for S3, R2, or any object store —
  every router already goes through these functions.
- **Roles**: add more than admin/worker by extending the `rol` CHECK constraint in the Alembic
  migration, `dependencies.py`, and the relevant frontend labels.

## License

MIT — see [`LICENSE`](LICENSE).
