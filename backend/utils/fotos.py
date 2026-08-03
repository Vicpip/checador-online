"""
Photo & logo storage.

Local-disk implementation. To swap for S3 / Cloudflare R2 / any object
store, reimplement `save_photo` and `get_photo_path` (jornada photos) and
`save_logo` (branding logo) — keep the same signatures so routers/*.py don't
need to change.

Hard rule: photos and logos are never served by direct filesystem/static
path. They are only ever returned through authenticated endpoints
(GET /fotos/{relative_path} validates the JWT first; the logo is public but
still served through GET /config/logo, never a raw static mount).
"""
import os
from datetime import date
from uuid import uuid4

from fastapi import UploadFile

from settings import get_settings


def save_photo(file: UploadFile, tipo: str, fecha: date) -> str:
    """Save a check-in/out photo to disk, return the relative path stored in DB."""
    settings = get_settings()
    base = settings.fotos_base_path
    rel = f"{fecha.year}/{fecha.month:02d}/{fecha.day:02d}/{uuid4()}-{tipo}.jpg"
    path = os.path.join(base, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(file.file.read())
    return rel.replace(os.sep, "/")


def get_photo_path(relative_url: str) -> str:
    """Return the absolute path for serving a jornada photo."""
    settings = get_settings()
    # Defend against path traversal — relative_url comes from the DB, but be
    # defensive since it round-trips through the API surface.
    safe_rel = os.path.normpath(relative_url).lstrip(os.sep)
    if safe_rel.startswith(".."):
        raise ValueError("Invalid photo path")
    return os.path.join(settings.fotos_base_path, safe_rel)


def save_logo(file: UploadFile) -> str:
    """Save the company logo to disk, return the relative path stored in config.logo_url."""
    settings = get_settings()
    ext = os.path.splitext(file.filename or "")[1].lower() or ".png"
    if ext not in (".png", ".jpg", ".jpeg", ".svg", ".webp"):
        ext = ".png"
    rel = f"logo{ext}"
    path = os.path.join(settings.logo_base_path, rel)
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "wb") as f:
        f.write(file.file.read())
    return rel


def get_logo_path(relative_url: str) -> str:
    settings = get_settings()
    safe_rel = os.path.normpath(relative_url).lstrip(os.sep)
    if safe_rel.startswith(".."):
        raise ValueError("Invalid logo path")
    return os.path.join(settings.logo_base_path, safe_rel)
