from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.goal import Goal
from app.schemas.goal import GoalCreate, GoalUpdate, GoalResponse
from app.auth.security import get_current_user

router = APIRouter(prefix="/goals", tags=["Goals"])


@router.post("", response_model=GoalResponse, status_code=201)
def create_goal(
    data: GoalCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = Goal(user_id=user.id, **data.model_dump())
    db.add(goal)
    db.commit()
    db.refresh(goal)
    return _with_progress(goal)


@router.get("", response_model=list[GoalResponse])
def list_goals(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goals = db.query(Goal).filter(Goal.user_id == user.id).order_by(Goal.created_at.desc()).all()
    return [_with_progress(g) for g in goals]


@router.put("/{goal_id}", response_model=GoalResponse)
def update_goal(
    goal_id: int,
    data: GoalUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user.id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(goal, field, value)
    db.commit()
    db.refresh(goal)
    return _with_progress(goal)


@router.delete("/{goal_id}", status_code=204)
def delete_goal(
    goal_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    goal = db.query(Goal).filter(Goal.id == goal_id, Goal.user_id == user.id).first()
    if not goal:
        raise HTTPException(status_code=404, detail="Goal not found")
    db.delete(goal)
    db.commit()


def _with_progress(goal: Goal) -> GoalResponse:
    pct = 0
    if goal.target_value > 0:
        pct = min(round((goal.current_value / goal.target_value) * 100, 1), 100)
    resp = GoalResponse.model_validate(goal)
    resp.progress_pct = pct
    return resp
