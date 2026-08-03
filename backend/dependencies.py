"""Shared FastAPI dependencies: current user resolution and role guards.

To add roles beyond admin/tecnico: extend the `rol` CHECK constraint in the
migration, add a matching `require_<role>` guard here, and update the
frontend labels — see CONTEXT_CHECADOR.md customization guide.
"""
import uuid

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session

from database import get_db
from models import Usuario
from utils.security import decode_access_token

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/login")


def get_current_user(
    token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)
) -> Usuario:
    credentials_error = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    payload = decode_access_token(token)
    if payload is None:
        raise credentials_error
    user_id = payload.get("sub")
    if user_id is None:
        raise credentials_error
    try:
        user = db.get(Usuario, uuid.UUID(user_id))
    except ValueError:
        raise credentials_error
    if user is None or not user.activo:
        raise credentials_error
    return user


def require_admin(user: Usuario = Depends(get_current_user)) -> Usuario:
    if user.rol != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
    return user


def require_tecnico(user: Usuario = Depends(get_current_user)) -> Usuario:
    if user.rol != "tecnico":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Worker access required")
    return user
