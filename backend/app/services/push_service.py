import json
from pywebpush import webpush, WebPushException
from sqlalchemy.orm import Session
from app.models.push_subscription import PushSubscription
from app.models.user import User
from app.config import settings


def _send_push(sub: PushSubscription, payload: str, db: Session) -> bool:
    """Send push to a single subscription. Returns False if sub expired."""
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
        return True
    except WebPushException as e:
        if e.response and e.response.status_code in (404, 410):
            db.delete(sub)
            db.commit()
        return False
    except Exception:
        return False


def send_push_to_user(db: Session, user_id: int, title: str, body: str, url: str = "/"):
    """Send a push notification to every subscription belonging to a user."""
    subs = db.query(PushSubscription).filter(
        PushSubscription.user_id == user_id
    ).all()
    payload = json.dumps({"title": title, "body": body, "url": url})
    sent = 0
    for sub in subs:
        if _send_push(sub, payload, db):
            sent += 1
    return sent


def send_push_to_all(db: Session, title: str, body: str, url: str = "/"):
    """Send a push notification to ALL subscribed users."""
    subs = db.query(PushSubscription).all()
    payload = json.dumps({"title": title, "body": body, "url": url})
    sent = 0
    for sub in subs:
        if _send_push(sub, payload, db):
            sent += 1
    return sent


def send_push_to_admins(db: Session, title: str, body: str, url: str = "/admin"):
    """Send a push notification to all admin users."""
    admin_ids = [uid for (uid,) in db.query(User.id).filter(User.is_admin == True).all()]
    if not admin_ids:
        return 0
    subs = db.query(PushSubscription).filter(
        PushSubscription.user_id.in_(admin_ids)
    ).all()
    payload = json.dumps({"title": title, "body": body, "url": url})
    sent = 0
    for sub in subs:
        if _send_push(sub, payload, db):
            sent += 1
    return sent
