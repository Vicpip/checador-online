"""
Daily "sin check-in" alert job.

Runs once a day at `settings.hora_limite_alerta` (business timezone) and,
if any active técnico has neither a jornada nor an approved ausencia yet
today, emails the full list to ADMIN_EMAILS in a single message. No-op
(nothing scheduled) if SMTP isn't configured, so instances that don't want
email don't pay for a background job that can never send anything.
"""
import logging

from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger

from database import SessionLocal
from models import Config
from routers.admin import tecnicos_sin_checkin_hoy
from settings import get_settings
from utils.email import render_email, send_email

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def _job_alerta_sin_checkin() -> None:
    settings = get_settings()
    db = SessionLocal()
    try:
        tecnicos = tecnicos_sin_checkin_hoy(db)
        if not tecnicos:
            return

        config = db.get(Config, 1)
        company_name = config.company_name if config else settings.app_name
        primary_color = config.primary_color if config else "#1F5FA5"
        logo_url = config.logo_url if config else None

        items_html = "".join(
            f"<li>{t.nombre} ({t.email})</li>" for t in tecnicos
        )
        body_html = f"""
            <p>Los siguientes {settings.worker_role_label.lower()}s no tienen
            check-in registrado hoy:</p>
            <ul>{items_html}</ul>
        """
        html = render_email(company_name, "Técnicos sin check-in", body_html, primary_color, logo_url)
        send_email(
            to=settings.admin_emails,
            subject=f"{settings.worker_role_label}s sin check-in — {len(tecnicos)}",
            html=html,
        )
    finally:
        db.close()


def iniciar_scheduler() -> None:
    """Start the background scheduler. Safe to call once at app startup."""
    global _scheduler
    settings = get_settings()

    if not settings.smtp_host or not settings.admin_emails:
        logger.info("Email not configured — sin-checkin-alerta scheduler not started")
        return

    if _scheduler is not None:
        return

    hh, mm = settings.hora_limite_alerta.split(":")
    scheduler = BackgroundScheduler(timezone=settings.business_timezone)
    scheduler.add_job(
        _job_alerta_sin_checkin,
        trigger=CronTrigger(hour=int(hh), minute=int(mm)),
        id="sin_checkin_alerta",
        replace_existing=True,
    )
    scheduler.start()
    _scheduler = scheduler
    logger.info("sin-checkin-alerta scheduler started, runs daily at %s", settings.hora_limite_alerta)
