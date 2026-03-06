from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text

from app.config import settings
from app.database import engine, SessionLocal, Base
from app.models import *  # noqa: F401 – register all models
from app.services.seed_data import seed_all
from app.routers import (
    auth,
    users,
    exercises,
    routines,
    workouts,
    body_metrics,
    nutrition,
    sleep,
    supplements,
    goals,
    ai,
    dashboard,
    store,
    benefits,
    admin,
    cardio,
    notifications,
    support,
)


def run_migrations():
    """Add missing columns to existing tables."""
    migrations = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code VARCHAR(5) DEFAULT '+52'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) DEFAULT 'blue'",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
            except Exception:
                pass
        conn.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    run_migrations()
    db = SessionLocal()
    try:
        seed_all(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    description="JOSSFITness – Plataforma de entrenamiento, salud y rendimiento",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(exercises.router)
app.include_router(routines.router)
app.include_router(workouts.router)
app.include_router(body_metrics.router)
app.include_router(nutrition.router)
app.include_router(sleep.router)
app.include_router(supplements.router)
app.include_router(goals.router)
app.include_router(ai.router)
app.include_router(dashboard.router)
app.include_router(store.router)
app.include_router(benefits.router)
app.include_router(admin.router)
app.include_router(cardio.router)
app.include_router(notifications.router)
app.include_router(support.router)


@app.get("/health")
def health_check():
    return {"status": "healthy", "app": settings.APP_NAME}
