from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func as sqlfunc
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.partner_brand import PartnerBrand
from app.models.partner_click import PartnerClick
from app.models.user import User
from app.auth.security import get_current_user
from pydantic import BaseModel


class BrandResponse(BaseModel):
    id: int
    name: str
    logo_url: str | None
    image_url: str | None = None
    description: str | None
    discount_text: str | None
    promo_code: str | None
    external_url: str
    category: str

    model_config = {"from_attributes": True}


router = APIRouter(prefix="/benefits", tags=["Benefits"])


def _get_admin(user: User = Depends(get_current_user)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin only")
    return user


@router.get("/brands", response_model=list[BrandResponse])
def list_brands(
    category: str | None = Query(None),
    db: Session = Depends(get_db),
    _=Depends(get_current_user),
):
    q = db.query(PartnerBrand).filter(PartnerBrand.active == True)
    if category:
        q = q.filter(PartnerBrand.category == category)
    return q.order_by(PartnerBrand.sort_order, PartnerBrand.name).all()


@router.post("/brands/{partner_id}/click")
def record_click(
    partner_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Record that a user clicked a partner link."""
    brand = db.query(PartnerBrand).filter(PartnerBrand.id == partner_id).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Partner no encontrado")
    click = PartnerClick(partner_brand_id=partner_id, user_id=user.id)
    db.add(click)
    db.commit()
    return {"ok": True}


@router.get("/partners/all-stats")
def all_partner_stats(
    admin: User = Depends(_get_admin),
    db: Session = Depends(get_db),
):
    """Bulk stats for all partners — avoids N+1 requests."""
    rows = (
        db.query(
            PartnerClick.partner_brand_id,
            sqlfunc.count(PartnerClick.id).label("total_clicks"),
            sqlfunc.count(sqlfunc.distinct(PartnerClick.user_id)).label("unique_users"),
        )
        .group_by(PartnerClick.partner_brand_id)
        .all()
    )
    result = {}
    for brand_id, total_clicks, unique_users in rows:
        result[str(brand_id)] = {
            "total_clicks": total_clicks,
            "unique_users": unique_users,
        }
    return result


@router.get("/partners/{partner_id}/stats")
def partner_stats(
    partner_id: int,
    admin: User = Depends(_get_admin),
    db: Session = Depends(get_db),
):
    """Per-partner detailed stats with user breakdown."""
    brand = db.query(PartnerBrand).filter(PartnerBrand.id == partner_id).first()
    if not brand:
        raise HTTPException(status_code=404, detail="Partner no encontrado")

    total_clicks = (
        db.query(sqlfunc.count(PartnerClick.id))
        .filter(PartnerClick.partner_brand_id == partner_id)
        .scalar() or 0
    )
    unique_users = (
        db.query(sqlfunc.count(sqlfunc.distinct(PartnerClick.user_id)))
        .filter(PartnerClick.partner_brand_id == partner_id)
        .scalar() or 0
    )

    user_rows = (
        db.query(
            PartnerClick.user_id,
            User.name,
            sqlfunc.count(PartnerClick.id).label("clicks"),
            sqlfunc.max(PartnerClick.clicked_at).label("last_click"),
        )
        .join(User, User.id == PartnerClick.user_id)
        .filter(PartnerClick.partner_brand_id == partner_id)
        .group_by(PartnerClick.user_id, User.name)
        .order_by(sqlfunc.max(PartnerClick.clicked_at).desc())
        .all()
    )

    users = [
        {
            "user_id": uid,
            "user_name": name,
            "clicks": clicks,
            "last_click": str(last_click) if last_click else None,
        }
        for uid, name, clicks, last_click in user_rows
    ]

    return {
        "total_clicks": total_clicks,
        "unique_users": unique_users,
        "users": users,
    }
