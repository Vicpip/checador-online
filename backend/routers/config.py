"""
Branding configuration.

GET /config is public and unauthenticated on purpose — both frontends need
it before login to paint the company's colors/logo/name on the login screen
itself. To keep the "never served by direct path" hard rule intact even for
a public asset, the logo is never exposed as a fetchable URL/static path at
all: it is embedded as a base64 data: URI inside this JSON response. There
is no endpoint that returns the raw logo file, and the upload path on disk
(config.logo_url in the DB) is never sent to the client.
"""
import base64
import mimetypes
import os
from datetime import time

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from dependencies import require_admin
from models import Config, Usuario
from schemas import ConfigOut, ConfigUpdate
from settings import get_settings
from utils.fotos import get_logo_path, save_logo


def _parse_hora(value: str) -> time:
    hh, mm = value.split(":")
    return time(hour=int(hh), minute=int(mm))

router = APIRouter(tags=["config"])

MAX_LOGO_BYTES = 2 * 1024 * 1024  # 2MB


def _get_or_create_config(db: Session) -> Config:
    config = db.get(Config, 1)
    if config is None:
        config = Config(id=1)
        db.add(config)
        db.commit()
        db.refresh(config)
    return config


def _to_out(config: Config) -> ConfigOut:
    settings = get_settings()
    logo_data_uri = None
    if config.logo_url:
        try:
            path = get_logo_path(config.logo_url)
            if os.path.isfile(path):
                mime = mimetypes.guess_type(path)[0] or "image/png"
                with open(path, "rb") as f:
                    encoded = base64.b64encode(f.read()).decode("ascii")
                logo_data_uri = f"data:{mime};base64,{encoded}"
        except ValueError:
            logo_data_uri = None

    return ConfigOut(
        company_name=config.company_name,
        primary_color=config.primary_color,
        secondary_color=config.secondary_color,
        accent_color=config.accent_color,
        logo_url=logo_data_uri,
        worker_role_label=settings.worker_role_label,
        admin_role_label=settings.admin_role_label,
        hora_inicio_jornada=config.hora_inicio_jornada or _parse_hora(settings.hora_inicio_jornada),
        hora_limite_entrada=config.hora_limite_entrada or _parse_hora(settings.hora_limite_entrada),
    )


@router.get("/config", response_model=ConfigOut)
def obtener_config(db: Session = Depends(get_db)):
    config = _get_or_create_config(db)
    return _to_out(config)


@router.put("/admin/config", response_model=ConfigOut)
def actualizar_config(
    body: ConfigUpdate,
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
):
    config = _get_or_create_config(db)
    updates = body.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(config, field, value)
    db.commit()
    db.refresh(config)
    return _to_out(config)


@router.post("/admin/config/logo", response_model=ConfigOut)
def subir_logo(
    file: UploadFile = File(...),
    _: Usuario = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if file.content_type not in ("image/png", "image/jpeg", "image/svg+xml", "image/webp"):
        raise HTTPException(status_code=400, detail="Unsupported image type")

    contents = file.file.read()
    if len(contents) > MAX_LOGO_BYTES:
        raise HTTPException(status_code=400, detail="Logo file too large (max 2MB)")
    file.file.seek(0)

    config = _get_or_create_config(db)
    relative_path = save_logo(file)
    config.logo_url = relative_path
    db.commit()
    db.refresh(config)
    return _to_out(config)
