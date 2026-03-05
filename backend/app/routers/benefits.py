from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.partner_brand import PartnerBrand
from app.auth.security import get_current_user
from pydantic import BaseModel


class BrandResponse(BaseModel):
    id: int
    name: str
    logo_url: str | None
    description: str | None
    discount_text: str | None
    promo_code: str | None
    external_url: str
    category: str

    model_config = {"from_attributes": True}


router = APIRouter(prefix="/benefits", tags=["Benefits"])


@router.get("/brands", response_model=list[BrandResponse])
def list_brands(
    category: str | None = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(PartnerBrand).filter(PartnerBrand.active == True)
    if category:
        q = q.filter(PartnerBrand.category == category)
    return q.order_by(PartnerBrand.name).all()
