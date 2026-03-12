import asyncio
import logging
from contextlib import asynccontextmanager
from datetime import datetime, date, timedelta, time

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
    suggestions,
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
        # Note analytics (views + read time)
        """CREATE TABLE IF NOT EXISTS note_views (
            id SERIAL PRIMARY KEY,
            note_id INTEGER REFERENCES notes(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            opened_at TIMESTAMP DEFAULT NOW(),
            read_seconds INTEGER DEFAULT 0
        )""",
        "CREATE INDEX IF NOT EXISTS idx_note_views_note_id ON note_views(note_id)",
        "CREATE INDEX IF NOT EXISTS idx_note_views_user_id ON note_views(user_id)",
        # Partner click analytics
        """CREATE TABLE IF NOT EXISTS partner_clicks (
            id SERIAL PRIMARY KEY,
            partner_brand_id INTEGER REFERENCES partner_brands(id) ON DELETE CASCADE,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            clicked_at TIMESTAMP DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS idx_partner_clicks_brand ON partner_clicks(partner_brand_id)",
        "CREATE INDEX IF NOT EXISTS idx_partner_clicks_user ON partner_clicks(user_id)",
        # Note push preference
        "ALTER TABLE notes ADD COLUMN IF NOT EXISTS send_push BOOLEAN DEFAULT TRUE",
        # Suggestions table
        """CREATE TABLE IF NOT EXISTS suggestions (
            id SERIAL PRIMARY KEY,
            user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
            category VARCHAR(20) NOT NULL,
            content TEXT NOT NULL,
            status VARCHAR(20) DEFAULT 'pendiente',
            admin_reply TEXT,
            created_at TIMESTAMP DEFAULT NOW()
        )""",
        "CREATE INDEX IF NOT EXISTS idx_suggestions_user_id ON suggestions(user_id)",
        # Clean up duplicate note notifications — keep only the oldest per (user_id, url)
        """DELETE FROM notifications
           WHERE id NOT IN (
               SELECT MIN(id) FROM notifications
               WHERE url LIKE '/notes/%%'
               GROUP BY user_id, url
           ) AND url LIKE '/notes/%%'""",
    ]
    # Each migration runs in its own transaction so a failure in one
    # doesn't abort all subsequent migrations (PostgreSQL behaviour).
    for i, sql in enumerate(migrations):
        try:
            with engine.begin() as conn:
                conn.execute(text(sql))
        except Exception as e:
            short = sql.strip()[:80].replace('\n', ' ')
            logger.warning(f"Migration #{i} skipped: {short}… → {e}")


async def publish_scheduled_notes():
    """Background task: check every 60s for notes ready to publish."""
    from app.models.note import Note
    from app.models.notification import Notification
    from app.models.user import User
    from app.services.push_service import send_push_to_all
    import re

    def strip_tags(html):
        text = re.sub(r'<[^>]+>', ' ', html)
        text = text.replace('&nbsp;', ' ').replace('&amp;', '&')
        return re.sub(r'\s+', ' ', text).strip()

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
                # Create in-app notifications for all users (skip duplicates)
                note_url = f"/notes/{note.id}"
                all_users = db.query(User.id).all()
                for (uid,) in all_users:
                    exists = db.query(Notification.id).filter(
                        Notification.user_id == uid,
                        Notification.url == note_url,
                    ).first()
                    if not exists:
                        db.add(Notification(
                            user_id=uid,
                            title=note.title,
                            body=f"Nueva nota: {note.title}",
                            url=note_url,
                        ))
                note.published = True
                db.commit()
                # Send push notification (only if enabled)
                if note.send_push:
                    try:
                        send_push_to_all(db, f"Nueva nota: {note.title}", strip_tags(note.content)[:100], f"/notes/{note.id}")
                    except Exception as push_err:
                        logger.warning(f"Push failed for note #{note.id}: {push_err}")
                logger.info(f"Published scheduled note #{note.id}: {note.title}")
            db.close()
        except Exception as e:
            logger.error(f"Error publishing scheduled notes: {e}")


async def send_sleep_reminders():
    """Background task: send ONE push reminder per day to log sleep.

    Only runs between 7:00-10:00 AM Mexico time.
    Uses the notifications table to track if already sent today (survives restarts).
    """
    from app.models.user import User
    from app.models.sleep import SleepLog
    from app.models.notification import Notification
    from app.services.push_service import send_push_to_user
    from app.utils.timezone import MX_TZ, today_mx

    while True:
        await asyncio.sleep(300)  # check every 5 min
        try:
            now_local = datetime.now(MX_TZ)

            # Only send between 7:00 and 10:00 AM
            if now_local.hour < 7 or now_local.hour >= 10:
                continue

            today = today_mx()
            db = SessionLocal()
            try:
                users = db.query(User).all()
                for user in users:
                    # Check if already sent reminder today (persisted in DB)
                    already_sent = db.query(Notification.id).filter(
                        Notification.user_id == user.id,
                        Notification.url == "/sleep",
                        Notification.created_at >= datetime.combine(today, time(0, 0)),
                    ).first()
                    if already_sent:
                        continue

                    # Check if already logged sleep today
                    logged = db.query(SleepLog).filter(
                        SleepLog.user_id == user.id,
                        SleepLog.date == today,
                    ).first()
                    if logged:
                        continue

                    # Send push + create in-app notification (so we don't send again)
                    db.add(Notification(
                        user_id=user.id,
                        title="Registra tu sueño",
                        body="No has registrado tu sueño de hoy",
                        url="/sleep",
                    ))
                    db.commit()
                    send_push_to_user(
                        db, user.id,
                        "JOSSFITness 😴",
                        "No has registrado tu sueño de hoy. ¡Registralo para un mejor seguimiento!",
                        "/sleep",
                    )
                    logger.info(f"Sleep reminder sent to user #{user.id}")
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error in sleep reminders: {e}")


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    run_migrations()
    db = SessionLocal()
    try:
        seed_all(db)
    finally:
        db.close()
    # Start background schedulers
    task1 = asyncio.create_task(publish_scheduled_notes())
    task2 = asyncio.create_task(send_sleep_reminders())
    yield
    task1.cancel()
    task2.cancel()


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
app.include_router(suggestions.router)


@app.get("/health")
def health_check():
    return {"status": "healthy", "app": settings.APP_NAME}


