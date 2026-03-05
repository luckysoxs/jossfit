from datetime import date

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.nutrition import NutritionLog
from app.schemas.nutrition import NutritionLogCreate, NutritionLogResponse, DailySummary
from app.auth.security import get_current_user

router = APIRouter(prefix="/nutrition", tags=["Nutrition"])


@router.post("", response_model=NutritionLogResponse, status_code=201)
def log_meal(
    data: NutritionLogCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = NutritionLog(user_id=user.id, **data.model_dump())
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("", response_model=list[NutritionLogResponse])
def list_nutrition(
    target_date: date | None = Query(None),
    limit: int = Query(50, le=200),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    q = db.query(NutritionLog).filter(NutritionLog.user_id == user.id)
    if target_date:
        q = q.filter(NutritionLog.date == target_date)
    return q.order_by(NutritionLog.date.desc(), NutritionLog.created_at).limit(limit).all()


@router.get("/summary/{target_date}", response_model=DailySummary)
def daily_summary(
    target_date: date,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    meals = (
        db.query(NutritionLog)
        .filter(NutritionLog.user_id == user.id, NutritionLog.date == target_date)
        .order_by(NutritionLog.created_at)
        .all()
    )
    return DailySummary(
        date=target_date,
        total_calories=sum(m.calories or 0 for m in meals),
        total_protein=sum(m.protein_g or 0 for m in meals),
        total_carbs=sum(m.carbs_g or 0 for m in meals),
        total_fat=sum(m.fat_g or 0 for m in meals),
        meals=meals,
    )


@router.delete("/{log_id}", status_code=204)
def delete_log(
    log_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = db.query(NutritionLog).filter(NutritionLog.id == log_id, NutritionLog.user_id == user.id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    db.delete(log)
    db.commit()
