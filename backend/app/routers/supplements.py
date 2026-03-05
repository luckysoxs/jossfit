from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.models.supplement import Supplement
from app.schemas.supplement import SupplementCreate, SupplementUpdate, SupplementResponse
from app.auth.security import get_current_user

router = APIRouter(prefix="/supplements", tags=["Supplements"])


@router.post("", response_model=SupplementResponse, status_code=201)
def create_supplement(
    data: SupplementCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = Supplement(user_id=user.id, **data.model_dump())
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.get("", response_model=list[SupplementResponse])
def list_supplements(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return db.query(Supplement).filter(Supplement.user_id == user.id).all()


@router.put("/{supp_id}", response_model=SupplementResponse)
def update_supplement(
    supp_id: int,
    data: SupplementUpdate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = db.query(Supplement).filter(Supplement.id == supp_id, Supplement.user_id == user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplement not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(s, field, value)
    db.commit()
    db.refresh(s)
    return s


@router.delete("/{supp_id}", status_code=204)
def delete_supplement(
    supp_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    s = db.query(Supplement).filter(Supplement.id == supp_id, Supplement.user_id == user.id).first()
    if not s:
        raise HTTPException(status_code=404, detail="Supplement not found")
    db.delete(s)
    db.commit()
