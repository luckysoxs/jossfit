import json
from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session
from app.models.push_subscription import PushSubscription
from app.config import settings


def send_push_to_user(db: Session, user_id: int, title: str, body: str, url: str = "/"):
    """Send a push notification to every subscription belonging to a user."""
    subs = db.query(PushSubscription).filter(
        PushSubscription.user_id == user_id
    ).all()

    payload = json.dumps({"title": title, "body": body, "url": url})

    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_MAILTO},
            )
        except WebPushException as e:
            if e.response and e.response.status_code in (404, 410):
                # Subscription expired or gone, remove it
                db.delete(sub)
                db.commit()
