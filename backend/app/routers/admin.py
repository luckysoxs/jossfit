from datetime import date, timedelta, datetime, timezone
from math import ceil

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import func as sqlfunc, or_, desc, asc

from app.database import get_db
from app.models.user import User
from app.models.workout import Workout, WorkoutSet
from app.models.routine import Routine
from app.models.body_metric import BodyMetric
from app.models.nutrition import NutritionLog
from app.models.sleep import SleepLog
from app.models.supplement import Supplement
from app.models.goal import Goal
from app.schemas.admin import (
    AdminUserListItem,
    AdminUserDetail,
    AdminUserStats,
    AdminUserUpdate,
    PaginatedUsers,
    GlobalStats,
)
from app.schemas.user import UserResponse
from app.auth.security import get_admin_user

router = APIRouter(prefix="/admin", tags=["Admin"])


# ─── GET /admin/stats ───────────────────────────────────────────────
@router.get("/stats", response_model=GlobalStats)
def get_global_stats(
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    today = date.today()
    week_ago = today - timedelta(days=7)
    month_ago = today - timedelta(days=30)

    total_users = db.query(sqlfunc.count(User.id)).scalar() or 0

    new_users_week = (
        db.query(sqlfunc.count(User.id))
        .filter(sqlfunc.date(User.created_at) >= week_ago)
        .scalar() or 0
    )
    new_users_month = (
        db.query(sqlfunc.count(User.id))
        .filter(sqlfunc.date(User.created_at) >= month_ago)
        .scalar() or 0
    )

    active_today = (
        db.query(sqlfunc.count(sqlfunc.distinct(Workout.user_id)))
        .filter(Workout.date == today)
        .scalar() or 0
    )
    active_week = (
        db.query(sqlfunc.count(sqlfunc.distinct(Workout.user_id)))
        .filter(Workout.date >= week_ago)
        .scalar() or 0
    )

    total_workouts = db.query(sqlfunc.count(Workout.id)).scalar() or 0
    workouts_week = (
        db.query(sqlfunc.count(Workout.id))
        .filter(Workout.date >= week_ago)
        .scalar() or 0
    )

    avg_per_user = round(total_workouts / total_users, 1) if total_users > 0 else 0.0

    # Distributions
    level_dist = {}
    for level, count in db.query(User.training_level, sqlfunc.count(User.id)).group_by(User.training_level).all():
        level_dist[str(level)] = count

    sex_dist = {}
    for sex, count in db.query(User.sex, sqlfunc.count(User.id)).group_by(User.sex).all():
        sex_dist[str(sex)] = count

    goal_dist = {}
    for goal, count in (
        db.query(User.fitness_goal, sqlfunc.count(User.id))
        .filter(User.fitness_goal.isnot(None))
        .group_by(User.fitness_goal)
        .all()
    ):
        goal_dist[str(goal)] = count

    return GlobalStats(
        total_users=total_users,
        new_users_this_week=new_users_week,
        new_users_this_month=new_users_month,
        active_users_today=active_today,
        active_users_this_week=active_week,
        total_workouts=total_workouts,
        workouts_this_week=workouts_week,
        avg_workouts_per_user=avg_per_user,
        training_level_distribution=level_dist,
        sex_distribution=sex_dist,
        goal_distribution=goal_dist,
    )


# ─── GET /admin/users ───────────────────────────────────────────────
@router.get("/users", response_model=PaginatedUsers)
def list_users(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    search: str | None = None,
    training_level: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(User)

    if search:
        term = f"%{search}%"
        query = query.filter(
            or_(
                User.name.ilike(term),
                User.email.ilike(term),
                User.phone.ilike(term),
            )
        )

    if training_level:
        query = query.filter(User.training_level == training_level)

    total = query.count()
    total_pages = max(ceil(total / per_page), 1)

    # Sorting
    sort_columns = {
        "created_at": User.created_at,
        "name": User.name,
        "email": User.email,
        "age": User.age,
    }
    sort_col = sort_columns.get(sort_by, User.created_at)
    order_func = desc if sort_order == "desc" else asc
    query = query.order_by(order_func(sort_col))

    users = query.offset((page - 1) * per_page).limit(per_page).all()

    # Get workout counts for these users
    user_ids = [u.id for u in users]
    workout_counts = {}
    last_workout_dates = {}

    if user_ids:
        counts = (
            db.query(Workout.user_id, sqlfunc.count(Workout.id), sqlfunc.max(Workout.date))
            .filter(Workout.user_id.in_(user_ids))
            .group_by(Workout.user_id)
            .all()
        )
        for uid, count, last_date in counts:
            workout_counts[uid] = count
            last_workout_dates[uid] = last_date

    items = []
    for u in users:
        items.append(
            AdminUserListItem(
                id=u.id,
                name=u.name,
                email=u.email,
                phone=u.phone,
                country_code=u.country_code if u.country_code else "+52",
                sex=str(u.sex.value) if hasattr(u.sex, 'value') else str(u.sex),
                age=u.age,
                training_level=str(u.training_level.value) if hasattr(u.training_level, 'value') else str(u.training_level),
                fitness_goal=u.fitness_goal,
                is_admin=u.is_admin,
                created_at=u.created_at,
                total_workouts=workout_counts.get(u.id, 0),
                last_workout_date=last_workout_dates.get(u.id),
            )
        )

    return PaginatedUsers(
        users=items,
        total=total,
        page=page,
        per_page=per_page,
        total_pages=total_pages,
    )


# ─── GET /admin/users/{user_id} ─────────────────────────────────────
@router.get("/users/{user_id}", response_model=AdminUserDetail)
def get_user_detail(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    workouts = db.query(Workout).filter(Workout.user_id == user_id).order_by(desc(Workout.date)).limit(50).all()
    routines = db.query(Routine).filter(Routine.user_id == user_id).all()
    body_metrics = db.query(BodyMetric).filter(BodyMetric.user_id == user_id).order_by(desc(BodyMetric.date)).limit(30).all()
    nutrition_logs = db.query(NutritionLog).filter(NutritionLog.user_id == user_id).order_by(desc(NutritionLog.date)).limit(50).all()
    sleep_logs = db.query(SleepLog).filter(SleepLog.user_id == user_id).order_by(desc(SleepLog.date)).limit(30).all()
    supplements = db.query(Supplement).filter(Supplement.user_id == user_id).all()
    goals = db.query(Goal).filter(Goal.user_id == user_id).all()

    # Stats
    total_workouts = db.query(sqlfunc.count(Workout.id)).filter(Workout.user_id == user_id).scalar() or 0
    last_workout = db.query(sqlfunc.max(Workout.date)).filter(Workout.user_id == user_id).scalar()
    avg_duration = db.query(sqlfunc.avg(Workout.duration_minutes)).filter(Workout.user_id == user_id).scalar()
    latest_metric = db.query(BodyMetric).filter(BodyMetric.user_id == user_id).order_by(desc(BodyMetric.date)).first()

    stats = AdminUserStats(
        total_workouts=total_workouts,
        total_routines=len(routines),
        total_nutrition_logs=db.query(sqlfunc.count(NutritionLog.id)).filter(NutritionLog.user_id == user_id).scalar() or 0,
        total_sleep_logs=db.query(sqlfunc.count(SleepLog.id)).filter(SleepLog.user_id == user_id).scalar() or 0,
        total_supplements=len(supplements),
        total_goals=len(goals),
        total_body_metrics=db.query(sqlfunc.count(BodyMetric.id)).filter(BodyMetric.user_id == user_id).scalar() or 0,
        last_workout_date=last_workout,
        avg_workout_duration=round(float(avg_duration), 1) if avg_duration else None,
        latest_weight=latest_metric.weight_kg if latest_metric else None,
    )

    # Build response dicts for related data
    def workout_dict(w):
        return {
            "id": w.id, "date": str(w.date), "duration_minutes": w.duration_minutes,
            "fatigue_level": w.fatigue_level, "notes": w.notes,
        }

    def routine_dict(r):
        return {"id": r.id, "name": r.name, "split_type": r.split_type, "days_per_week": r.days_per_week}

    def metric_dict(m):
        return {
            "id": m.id, "date": str(m.date), "weight_kg": m.weight_kg,
            "body_fat_pct": m.body_fat_pct, "muscle_mass_kg": m.muscle_mass_kg,
        }

    def nutrition_dict(n):
        return {
            "id": n.id, "date": str(n.date), "meal_type": str(n.meal_type.value) if hasattr(n.meal_type, 'value') else str(n.meal_type),
            "calories": n.calories, "protein_g": n.protein_g,
        }

    def sleep_dict(s):
        return {
            "id": s.id, "date": str(s.date), "hours_slept": s.hours_slept,
            "quality": s.quality,
        }

    def supplement_dict(s):
        return {"id": s.id, "name": s.name, "dose": s.dose, "active": s.active}

    def goal_dict(g):
        return {
            "id": g.id, "goal_type": str(g.goal_type.value) if hasattr(g.goal_type, 'value') else str(g.goal_type),
            "target_value": g.target_value, "current_value": g.current_value,
            "status": str(g.status.value) if hasattr(g.status, 'value') else str(g.status),
        }

    return AdminUserDetail(
        user=UserResponse.model_validate(user),
        workouts=[workout_dict(w) for w in workouts],
        routines=[routine_dict(r) for r in routines],
        body_metrics=[metric_dict(m) for m in body_metrics],
        nutrition_logs=[nutrition_dict(n) for n in nutrition_logs],
        sleep_logs=[sleep_dict(s) for s in sleep_logs],
        supplements=[supplement_dict(s) for s in supplements],
        goals=[goal_dict(g) for g in goals],
        stats=stats,
    )


# ─── PUT /admin/users/{user_id} ─────────────────────────────────────
@router.put("/users/{user_id}", response_model=UserResponse)
def update_user(
    user_id: int,
    data: AdminUserUpdate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    updates = data.model_dump(exclude_unset=True)
    for field, value in updates.items():
        setattr(user, field, value)

    db.commit()
    db.refresh(user)
    return UserResponse.model_validate(user)


# ─── DELETE /admin/users/{user_id} ──────────────────────────────────
@router.delete("/users/{user_id}")
def delete_user(
    user_id: int,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete yourself")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    db.delete(user)
    db.commit()
    return {"detail": f"User {user.name} deleted successfully"}
