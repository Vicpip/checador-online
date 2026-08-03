"""
Authenticated photo serving.

Hard rule: photos are never served by direct/static path. This is the only
way to retrieve a check-in/out photo — it validates the JWT first, and a
técnico may only view photos from their own jornadas (an admin may view any).
"""
import os

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from database import get_db
from dependencies import get_current_user
from models import Jornada, Usuario
from utils.fotos import get_photo_path

router = APIRouter(tags=["fotos"])


@router.get("/fotos/{relative_path:path}")
def obtener_foto(
    relative_path: str,
    user: Usuario = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if user.rol != "admin":
        pertenece = db.scalar(
            select(Jornada).where(
                Jornada.tecnico_id == user.id,
                (Jornada.entrada_foto_url == relative_path)
                | (Jornada.salida_foto_url == relative_path),
            )
        )
        if pertenece is None:
            raise HTTPException(status_code=403, detail="Not allowed to view this photo")

    try:
        path = get_photo_path(relative_path)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid photo path")

    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Photo not found")

    return FileResponse(path, media_type="image/jpeg")
