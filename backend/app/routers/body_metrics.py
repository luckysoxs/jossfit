from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.body_metric import BodyMetric
from app.schemas.body_metric import BodyMetricCreate, BodyMetricResponse
from app.auth.security import get_current_user

router = APIRouter(prefix="/body-metrics", tags=["Body Metrics"])


@router.post("", response_model=BodyMetricResponse, status_code=201)
def create_metric(
    data: BodyMetricCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    metric = BodyMetric(user_id=user.id, **data.model_dump())
    db.add(metric)
    db.commit()
    db.refresh(metric)
    return metric


@router.get("", response_model=list[BodyMetricResponse])
def list_metrics(
    limit: int = Query(30, le=100),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return (
        db.query(BodyMetric)
        .filter(BodyMetric.user_id == user.id)
        .order_by(BodyMetric.date.desc())
        .limit(limit)
        .all()
    )


@router.delete("/{metric_id}", status_code=204)
def delete_metric(
    metric_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    m = db.query(BodyMetric).filter(BodyMetric.id == metric_id, BodyMetric.user_id == user.id).first()
    if not m:
        raise HTTPException(status_code=404, detail="Metric not found")
    db.delete(m)
    db.commit()
