from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import admin, auth, config, fotos, jornadas, servicios
from settings import get_settings
from utils.scheduler import iniciar_scheduler

settings = get_settings()

app = FastAPI(
    title=settings.app_name,
    description="Open source field-check workforce check-in system.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(jornadas.router)
app.include_router(servicios.router)
app.include_router(admin.router)
app.include_router(config.router)
app.include_router(fotos.router)


@app.on_event("startup")
def _startup():
    iniciar_scheduler()


@app.get("/health", tags=["health"])
def health():
    return {"status": "ok", "app_name": settings.app_name}
