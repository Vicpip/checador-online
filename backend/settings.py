"""
Centralized environment configuration.

Every value that customizes this deployment (branding labels, business rules,
storage paths) is read from the environment here — see .env.example for the
full documented list. Nothing UI-facing should be hardcoded outside of this
module and the `config` DB table (branding colors/logo/company name, which
are runtime-editable via /admin/config instead of env vars).
"""
import os
from functools import lru_cache


class Settings:
    # Database
    database_url: str = os.getenv(
        "DATABASE_URL", "postgresql://fieldcheck:fieldcheck@localhost:5432/fieldcheck"
    )

    # Security
    secret_key: str = os.getenv("SECRET_KEY", "change-me-to-a-random-32-char-string")
    algorithm: str = os.getenv("ALGORITHM", "HS256")
    access_token_expire_hours: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_HOURS", "8"))

    # App branding (fallback labels; live branding colors/logo/name live in the
    # `config` DB table and are served via GET /config)
    app_name: str = os.getenv("APP_NAME", "field-check")
    worker_role_label: str = os.getenv("WORKER_ROLE_LABEL", "Técnico")
    admin_role_label: str = os.getenv("ADMIN_ROLE_LABEL", "Administrador")

    # Timezone — business/display timezone for this deployment. Timestamps are
    # always stored in the DB as UTC; this only governs wall-clock business-day
    # boundaries (date.today() et al, via the container's TZ env var) and is
    # the timezone both frontends render all times in.
    business_timezone: str = os.getenv("TZ", "America/Mexico_City")

    # Business rules (env var fallbacks — overridden per-deployment by the
    # `config` DB table's hora_inicio_jornada / hora_limite_entrada columns
    # when set; see utils/puntualidad.py)
    hora_inicio_jornada: str = os.getenv("HORA_INICIO_JORNADA", "08:00")
    hora_limite_entrada: str = os.getenv("HORA_LIMITE_ENTRADA", "08:00")

    # Hour (business timezone, HH:MM) at which the daily "sin check-in" alert
    # job runs — see utils/scheduler.py. Env-only (not in the `config` DB
    # table); changing it requires a server restart.
    hora_limite_alerta: str = os.getenv("HORA_LIMITE_ALERTA", "09:30")

    # ── Email (all optional — instances without SMTP configured simply don't
    #    send notifications; see utils/email.py) ────────────────────────────
    smtp_host: str | None = os.getenv("SMTP_HOST") or None
    smtp_port: int = int(os.getenv("SMTP_PORT", "587"))
    smtp_user: str | None = os.getenv("SMTP_USER") or None
    smtp_password: str | None = os.getenv("SMTP_PASSWORD") or None
    smtp_from: str | None = os.getenv("SMTP_FROM") or None
    smtp_from_name: str = os.getenv("SMTP_FROM_NAME", "Field Check")

    # Comma-separated list of admin emails notified for permiso requests and
    # the sin-check-in alert.
    admin_emails: list[str] = [
        e.strip() for e in os.getenv("ADMIN_EMAILS", "").split(",") if e.strip()
    ]

    # Photo storage
    fotos_base_path: str = os.getenv("FOTOS_BASE_PATH", "/var/fieldcheck/fotos")
    foto_max_width: int = int(os.getenv("FOTO_MAX_WIDTH", "1200"))
    foto_quality: float = float(os.getenv("FOTO_QUALITY", "0.75"))

    # Logo storage (separate from per-jornada photos, per spec)
    logo_base_path: str = os.getenv("LOGO_BASE_PATH", "/var/fieldcheck/logo")

    # CORS
    cors_origins: list[str] = [
        o.strip()
        for o in os.getenv("CORS_ORIGINS", "http://localhost:5173,http://localhost:5174").split(",")
        if o.strip()
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
