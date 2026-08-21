"""Fixtures de prueba: SQLite en memoria, cliente HTTP y usuarios."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app
from app.models import *  # noqa: F401,F403 — registra todos los modelos
from app.models.exercise import Exercise, MuscleGroup, ExerciseCategory


@pytest.fixture
def engine():
    eng = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=eng)
    yield eng
    Base.metadata.drop_all(bind=eng)
    eng.dispose()


@pytest.fixture
def db_session(engine):
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    session = Session()
    yield session
    session.close()


@pytest.fixture
def client(engine):
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = Session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    # Sin context manager: no dispara lifespan, no corre seed ni migraciones.
    yield TestClient(app)
    app.dependency_overrides.clear()


def make_user(client, email, **kwargs):
    """Registra un usuario y devuelve token, datos y headers listos para usar."""
    payload = {
        "email": email,
        "password": "Password123",
        "name": kwargs.get("name", email.split("@")[0]),
        "age": kwargs.get("age", 30),
        "sex": kwargs.get("sex", "male"),
        "height_cm": kwargs.get("height_cm", 175.0),
        "weight_kg": kwargs.get("weight_kg", 75.0),
        "training_level": kwargs.get("training_level", "intermediate"),
        "accepted_terms": True,
    }
    res = client.post("/auth/register", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    return {
        "token": data["access_token"],
        "user": data["user"],
        "headers": {"Authorization": f"Bearer {data['access_token']}"},
    }


@pytest.fixture
def seed_exercises(db_session):
    """Un punado de ejercicios para poder armar rutinas."""
    rows = [
        Exercise(name="Bench Press", name_es="Press de banca",
                 muscle_group=MuscleGroup.CHEST, category=ExerciseCategory.COMPOUND),
        Exercise(name="Squat", name_es="Sentadilla",
                 muscle_group=MuscleGroup.QUADRICEPS, category=ExerciseCategory.COMPOUND),
        Exercise(name="Bicep Curl", name_es="Curl de biceps",
                 muscle_group=MuscleGroup.BICEPS, category=ExerciseCategory.ISOLATION),
    ]
    db_session.add_all(rows)
    db_session.commit()
    return [r.id for r in rows]
