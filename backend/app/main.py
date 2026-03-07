import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from sqlalchemy import text

from app.config import settings
from app.database import engine, SessionLocal, Base
from app.models import *  # noqa: F401 – register all models
from app.services.seed_data import seed_all

logger = logging.getLogger(__name__)
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
    notes,
    notification_center,
    walkie_talkie,
)


def run_migrations():
    """Add missing columns to existing tables."""
    migrations = [
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS phone VARCHAR(20)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS country_code VARCHAR(5) DEFAULT '+52'",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) DEFAULT 'blue'",
        "ALTER TABLE partner_brands ADD COLUMN IF NOT EXISTS sort_order INTEGER DEFAULT 0",
        "ALTER TABLE partner_brands ADD COLUMN IF NOT EXISTS image_url VARCHAR(500)",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS has_condition BOOLEAN DEFAULT FALSE",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS pathologies JSONB",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS medications JSONB",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS mobility_limitations JSONB",
        "ALTER TABLE users ADD COLUMN IF NOT EXISTS accepted_terms BOOLEAN DEFAULT TRUE",
        "ALTER TABLE routines ADD COLUMN IF NOT EXISTS ai_data JSONB",
        "ALTER TABLE routines ADD COLUMN IF NOT EXISTS generation_type VARCHAR(20) DEFAULT 'normal'",
        # Walkie-Talkie tables
        """CREATE TABLE IF NOT EXISTS admin_chats (
            id SERIAL PRIMARY KEY,
            name VARCHAR(100),
            is_group BOOLEAN DEFAULT FALSE,
            created_by INTEGER REFERENCES users(id) ON DELETE CASCADE,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        """CREATE TABLE IF NOT EXISTS admin_chat_members (
            id SERIAL PRIMARY KEY,
            chat_id INTEGER REFERENCES admin_chats(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            last_read_at TIMESTAMP
        )""",
        "CREATE INDEX IF NOT EXISTS idx_acm_chat_id ON admin_chat_members(chat_id)",
        "CREATE INDEX IF NOT EXISTS idx_acm_user_id ON admin_chat_members(user_id)",
        """CREATE TABLE IF NOT EXISTS admin_chat_messages (
            id SERIAL PRIMARY KEY,
            chat_id INTEGER REFERENCES admin_chats(id) ON DELETE CASCADE,
            sender_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            content TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS idx_acmsg_chat_id ON admin_chat_messages(chat_id)",
        # Voice message columns
        "ALTER TABLE admin_chat_messages ADD COLUMN IF NOT EXISTS message_type VARCHAR(10) DEFAULT 'text'",
        "ALTER TABLE admin_chat_messages ADD COLUMN IF NOT EXISTS audio_data BYTEA",
        "ALTER TABLE admin_chat_messages ADD COLUMN IF NOT EXISTS audio_duration FLOAT",
        # Exercise Spanish names
        "ALTER TABLE exercises ADD COLUMN IF NOT EXISTS name_es VARCHAR(100)",
        # Routine weekday schedule
        "ALTER TABLE routines ADD COLUMN IF NOT EXISTS rest_weekdays JSONB",
        # Notes scheduling and editing
        "ALTER TABLE notes ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP",
        "ALTER TABLE notes ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP",
        "ALTER TABLE notes ADD COLUMN IF NOT EXISTS published BOOLEAN DEFAULT FALSE",
        # Mark all existing notes as published (they were created before this feature)
        "UPDATE notes SET published = TRUE WHERE published IS NULL OR published = FALSE AND scheduled_at IS NULL",
    ]
    with engine.connect() as conn:
        for sql in migrations:
            try:
                conn.execute(text(sql))
            except Exception:
                pass
        conn.commit()


async def publish_scheduled_notes():
    """Background task: check every 60s for notes ready to publish."""
    from app.models.note import Note
    from app.models.notification import Notification
    from app.models.user import User
    from app.services.push_service import send_push_to_all

    while True:
        await asyncio.sleep(60)
        try:
            db = SessionLocal()
            now = datetime.utcnow()
            pending = (
                db.query(Note)
                .filter(
                    Note.scheduled_at.isnot(None),
                    Note.scheduled_at <= now,
                    Note.published == False,
                )
                .all()
            )
            for note in pending:
                # Create in-app notifications for all users
                all_users = db.query(User.id).all()
                for (uid,) in all_users:
                    db.add(Notification(
                        user_id=uid,
                        title=note.title,
                        body=f"Nueva nota: {note.title}",
                        url=f"/notes/{note.id}",
                    ))
                note.published = True
                db.commit()
                # Send push notification
                send_push_to_all(db, f"Nueva nota: {note.title}", note.content[:100], f"/notes/{note.id}")
                logger.info(f"Published scheduled note #{note.id}: {note.title}")
            db.close()
        except Exception as e:
            logger.error(f"Error publishing scheduled notes: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    run_migrations()
    db = SessionLocal()
    try:
        seed_all(db)
    finally:
        db.close()
    # Start background scheduler
    task = asyncio.create_task(publish_scheduled_notes())
    yield
    task.cancel()


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
app.include_router(notes.router)
app.include_router(notification_center.router)
app.include_router(walkie_talkie.router)


@app.get("/health")
def health_check():
    return {"status": "healthy", "app": settings.APP_NAME}
