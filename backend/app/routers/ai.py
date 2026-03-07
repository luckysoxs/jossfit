from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.exercise import Exercise
from app.models.one_rep_max import OneRepMax
from app.schemas.ai import (
    GenerateRoutineRequest,
    OneRepMaxResponse,
    ProgressionResponse,
    TrainingAnalysis,
)
from app.schemas.routine import RoutineCreate, RoutineResponse
from app.auth.security import get_current_user
from app.services.algorithms import (
    calculate_1rm_epley,
    calculate_1rm_brzycki,
    get_progression_recommendation,
    calculate_weekly_volume,
    detect_overtraining,
    check_deload_needed,
)
from app.ai.routine_generator import generate_routine
from app.models.routine import Routine, RoutineDay, RoutineExercise

router = APIRouter(prefix="/ai", tags=["AI / Smart Training"])


@router.post("/generate-routine", response_model=RoutineResponse)
def generate_smart_routine(
    req: GenerateRoutineRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Build user_data dict for medical-aware generation
    user_data = {
        "has_condition": user.has_condition if hasattr(user, "has_condition") else False,
        "pathologies": user.pathologies if hasattr(user, "pathologies") else None,
        "medications": user.medications if hasattr(user, "medications") else None,
        "mobility_limitations": user.mobility_limitations if hasattr(user, "mobility_limitations") else None,
        "age": user.age,
        "weight_kg": user.weight_kg,
    }

    routine_data = generate_routine(
        db=db,
        objective=req.objective,
        days_per_week=req.days_per_week,
        training_level=req.training_level or user.training_level.value,
        priority_muscles=req.priority_muscles,
        split_preference=req.split_preference,
        user_data=user_data,
        custom_days=[d.model_dump() for d in req.custom_days] if req.custom_days else None,
    )

    # Save to database
    routine = Routine(
        user_id=user.id,
        name=routine_data["name"],
        split_type=routine_data["split_type"],
        objective=routine_data["objective"],
        days_per_week=routine_data["days_per_week"],
        generation_type=routine_data.get("generation_type", "normal"),
        ai_data=routine_data.get("ai_data"),
    )
    db.add(routine)
    db.flush()

    for day_data in routine_data["days"]:
        day = RoutineDay(
            routine_id=routine.id,
            day_number=day_data["day_number"],
            name=day_data["name"],
            focus=day_data["focus"],
        )
        db.add(day)
        db.flush()

        for ex_data in day_data["exercises"]:
            ex = RoutineExercise(
                routine_day_id=day.id,
                exercise_id=ex_data["exercise_id"],
                order=ex_data["order"],
                sets=ex_data["sets"],
                reps_min=ex_data["reps_min"],
                reps_max=ex_data["reps_max"],
                rest_seconds=ex_data["rest_seconds"],
            )
            db.add(ex)

    db.commit()
    db.refresh(routine)

    from app.routers.routines import _load_full_routine

    return _load_full_routine(db, routine.id)


@router.get("/1rm/{exercise_id}", response_model=OneRepMaxResponse)
def estimate_1rm(
    exercise_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    orm = (
        db.query(OneRepMax)
        .filter(OneRepMax.user_id == user.id, OneRepMax.exercise_id == exercise_id)
        .order_by(OneRepMax.date.desc())
        .first()
    )

    if not orm:
        return OneRepMaxResponse(
            exercise_id=exercise_id,
            exercise_name=exercise.name if exercise else "Unknown",
            epley_1rm=0, brzycki_1rm=0, average_1rm=0,
            source_weight=0, source_reps=0,
        )

    epley = calculate_1rm_epley(orm.source_weight, orm.source_reps)
    brzycki = calculate_1rm_brzycki(orm.source_weight, orm.source_reps)

    return OneRepMaxResponse(
        exercise_id=exercise_id,
        exercise_name=exercise.name if exercise else "Unknown",
        epley_1rm=epley,
        brzycki_1rm=brzycki,
        average_1rm=round((epley + brzycki) / 2, 1),
        source_weight=orm.source_weight,
        source_reps=orm.source_reps,
    )


@router.get("/progression/{exercise_id}", response_model=ProgressionResponse)
def get_progression(
    exercise_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    exercise = db.query(Exercise).filter(Exercise.id == exercise_id).first()
    result = get_progression_recommendation(db, user.id, exercise_id)

    return ProgressionResponse(
        exercise_id=exercise_id,
        exercise_name=exercise.name if exercise else "Unknown",
        current_weight=result.get("current_weight", 0),
        recommended_weight=result.get("recommended_weight", 0),
        action=result["action"],
        reason=result["reason"],
    )


@router.get("/training-analysis", response_model=TrainingAnalysis)
def training_analysis(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    volume = calculate_weekly_volume(db, user.id)
    overtraining = detect_overtraining(db, user.id)
    deload = check_deload_needed(db, user.id)

    return TrainingAnalysis(
        volume_analysis=volume,
        overtraining_risk=overtraining["risk"],
        overtraining_alerts=overtraining["alerts"],
        deload_recommended=deload["recommended"],
        deload_reason=deload["reason"],
        weeks_since_deload=deload["weeks_since_deload"],
    )
