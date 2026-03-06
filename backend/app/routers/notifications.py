from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.database import get_db
from app.models.user import User
from app.models.push_subscription import PushSubscription
from app.auth.security import get_current_user
from app.config import settings

router = APIRouter(prefix="/notifications", tags=["Notifications"])


class PushSubscriptionCreate(BaseModel):
    endpoint: str
    keys: dict  # { p256dh: str, auth: str }


@router.get("/vapid-public-key")
def get_vapid_public_key():
    """Return the VAPID public key so the frontend can subscribe to push."""
    return {"public_key": settings.VAPID_PUBLIC_KEY}


@router.post("/subscribe", status_code=201)
def subscribe(
    data: PushSubscriptionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Register a push subscription for the current user."""
    existing = db.query(PushSubscription).filter(
        PushSubscription.endpoint == data.endpoint
    ).first()

    if existing:
        existing.user_id = user.id
        existing.p256dh = data.keys["p256dh"]
        existing.auth = data.keys["auth"]
    else:
        sub = PushSubscription(
            user_id=user.id,
            endpoint=data.endpoint,
            p256dh=data.keys["p256dh"],
            auth=data.keys["auth"],
        )
        db.add(sub)

    db.commit()
    return {"ok": True}


@router.delete("/unsubscribe", status_code=204)
def unsubscribe(
    data: PushSubscriptionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Remove a push subscription for the current user."""
    db.query(PushSubscription).filter(
        PushSubscription.endpoint == data.endpoint,
        PushSubscription.user_id == user.id,
    ).delete()
    db.commit()
