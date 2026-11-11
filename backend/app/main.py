from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from . import migrate, models  # noqa: F401  (registers tables on Base)
from .config import settings
from .db import Base, engine
from .routers_admin import auth_router, router as admin_router
from .routers_auth import router as customer_auth_router
from .routers_media import router as media_router
from .routers_public import router as public_router
from .routers_workspace import admin_router as workspace_admin_router, customer_router as workspace_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)  # new tables
    migrate.run(engine)  # new columns on existing tables
    Path(settings.media_dir).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(title="S16 Design Studio API", version="2.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)

app.include_router(public_router)
app.include_router(auth_router)
app.include_router(customer_auth_router)
app.include_router(admin_router)
app.include_router(media_router)
app.include_router(workspace_router)
app.include_router(workspace_admin_router)

# uploaded images, e.g. /media/<uuid>.jpg
Path(settings.media_dir).mkdir(parents=True, exist_ok=True)
app.mount("/media", StaticFiles(directory=settings.media_dir), name="media")


@app.get("/api/health", tags=["meta"])
def health():
    return {"status": "ok"}
