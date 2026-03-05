from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.sleep import SleepLog
from app.schemas.sleep import SleepLogCreate, SleepLogResponse
from app.auth.security import get_current_user

router = APIRouter(prefix="/sleep", tags=["Sleep"])


@router.post("", response_model=SleepLogResponse, status_code=201)
def log_sleep(
    data: SleepLogCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = SleepLog(user_id=user.id, **data.model_dump())
    db.add(log)
    db.commit()
    db.refresh(log)
    return log


@router.get("", response_model=list[SleepLogResponse])
def list_sleep(
    limit: int = Query(30, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(SleepLog)
        .filter(SleepLog.user_id == user.id)
        .order_by(SleepLog.date.desc())
        .limit(limit)
        .all()
    )


@router.delete("/{log_id}", status_code=204)
def delete_sleep(
    log_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    log = db.query(SleepLog).filter(SleepLog.id == log_id, SleepLog.user_id == user.id).first()
    if not log:
        raise HTTPException(status_code=404, detail="Log not found")
    db.delete(log)
    db.commit()
