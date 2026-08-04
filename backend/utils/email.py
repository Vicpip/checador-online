"""
Outbound email notifications.

Uses only the Python standard library (smtplib + email.mime) — no new
dependency. Every instance is expected to be able to run without email
configured (self-hosted deployments may not want it): if SMTP_HOST is unset,
`send_email` logs a warning and returns without raising. When configured,
the actual SMTP conversation happens on a background thread so callers
(request handlers, the scheduler job) never block on it.
"""
import base64
import logging
import mimetypes
import os
import smtplib
import threading
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText

from settings import get_settings
from utils.fotos import get_logo_path

logger = logging.getLogger(__name__)


def _send_sync(to: list[str], subject: str, html: str) -> None:
    settings = get_settings()
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"{settings.smtp_from_name} <{settings.smtp_from}>"
    msg["To"] = ", ".join(to)
    msg.attach(MIMEText(html, "html", "utf-8"))

    logger.warning(
        "[EMAIL DEBUG] _send_sync (background thread): conectando a %s:%s como %r para enviar %r a %r",
        settings.smtp_host, settings.smtp_port, settings.smtp_user, subject, to,
    )
    try:
        with smtplib.SMTP(settings.smtp_host, settings.smtp_port, timeout=10) as server:
            server.starttls()
            if settings.smtp_user and settings.smtp_password:
                server.login(settings.smtp_user, settings.smtp_password)
            refused = server.sendmail(settings.smtp_from, to, msg.as_string())
        if refused:
            # sendmail() only raises if ALL recipients are refused — a partial
            # refusal (e.g. one malformed address in `to`) returns silently
            # otherwise, so this must be logged explicitly or it's invisible.
            logger.warning(
                "[EMAIL DEBUG] servidor SMTP rechazó algunos destinatarios de %r: %r",
                subject, refused,
            )
        else:
            logger.warning(
                "[EMAIL DEBUG] send_email OK: %r entregado a %r sin destinatarios rechazados",
                subject, to,
            )
    except Exception:
        logger.exception("[EMAIL DEBUG] Failed to send email %r to %r", subject, to)


def send_email(to: list[str], subject: str, html: str) -> None:
    """
    Send an HTML email in a background thread. No-op (with a logged warning)
    if SMTP_HOST isn't configured or `to` is empty — callers don't need to
    guard for either case themselves.
    """
    settings = get_settings()
    logger.warning(
        "[EMAIL DEBUG] send_email() called: subject=%r to=%r smtp_host=%r",
        subject, to, settings.smtp_host,
    )
    if not settings.smtp_host:
        logger.warning("SMTP_HOST not configured — skipping email %r", subject)
        return
    if not to:
        logger.warning("No recipients for email %r — skipping", subject)
        return

    thread = threading.Thread(target=_send_sync, args=(to, subject, html), daemon=True)
    thread.start()
    logger.warning("[EMAIL DEBUG] background thread started (ident=%s) for email %r", thread.ident, subject)


def _resolve_logo_data_uri(logo_url: str | None) -> str | None:
    """
    Turn `config.logo_url` (a relative on-disk filename, e.g. "logo.png") into an
    embeddable `data:` URI. The logo has no fetchable HTTP URL by design (see
    hard rule in CLAUDE.md — same reason `routers/config.py::_to_out` does this
    same base64-embed for `GET /config` instead of returning a static path).
    """
    if not logo_url:
        return None
    try:
        path = get_logo_path(logo_url)
    except ValueError:
        return None
    if not os.path.isfile(path):
        return None
    mime = mimetypes.guess_type(path)[0] or "image/png"
    with open(path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("ascii")
    return f"data:{mime};base64,{encoded}"


def render_email(
    company_name: str,
    heading: str,
    body_html: str,
    primary_color: str = "#1F5FA5",
    logo_url: str | None = None,
) -> str:
    """Wrap `body_html` in a simple, professional HTML shell (header + footer),
    themed with the admin's configured company name/color/logo."""
    logo_data_uri = _resolve_logo_data_uri(logo_url)
    logo_html = (
        f'<img src="{logo_data_uri}" alt="{company_name}" '
        f'style="height:28px; vertical-align:middle; margin-right:10px;">'
        if logo_data_uri
        else ""
    )
    return f"""\
<!DOCTYPE html>
<html lang="es">
  <body style="margin:0; padding:0; background-color:#F3F4F6; font-family:Arial, Helvetica, sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F6; padding:24px 0;">
      <tr>
        <td align="center">
          <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#FFFFFF; border-radius:8px; overflow:hidden;">
            <tr>
              <td style="background-color:{primary_color}; padding:20px 24px;">
                {logo_html}<span style="color:#FFFFFF; font-size:18px; font-weight:bold; vertical-align:middle;">{company_name}</span>
              </td>
            </tr>
            <tr>
              <td style="padding:24px;">
                <h1 style="margin:0 0 16px; font-size:16px; color:#111827;">{heading}</h1>
                <div style="font-size:14px; color:#374151; line-height:1.6;">
                  {body_html}
                </div>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 24px; background-color:#F9FAFB; border-top:1px solid #E5E7EB;">
                <p style="margin:0; font-size:12px; color:#9CA3AF;">
                  Este es un mensaje automático de {company_name}.
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
"""
