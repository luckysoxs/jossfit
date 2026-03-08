"""Suggestion box — users submit ideas/improvements, admins manage them."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.database import get_db
from app.models.user import User
from app.models.suggestion import Suggestion
from app.schemas.suggestion import SuggestionCreate, SuggestionResponse, SuggestionUpdate
from app.auth.security import get_current_user, get_admin_user

router = APIRouter(tags=["Suggestions"])


# ─── USER ENDPOINTS ────────────────────────────────────────────────

@router.get("/suggestions", response_model=list[SuggestionResponse])
def get_my_suggestions(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    suggestions = (
        db.query(Suggestion)
        .filter(Suggestion.user_id == user.id)
        .order_by(desc(Suggestion.created_at))
        .all()
    )
    return [
        SuggestionResponse(
            id=s.id,
            user_id=s.user_id,
            user_name=user.name,
            category=s.category,
            content=s.content,
            status=s.status,
            admin_reply=s.admin_reply,
            created_at=s.created_at,
        )
        for s in suggestions
    ]


@router.post("/suggestions", response_model=SuggestionResponse, status_code=201)
def create_suggestion(
    data: SuggestionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if data.category not in ("mejora", "idea", "bug", "otro"):
        raise HTTPException(status_code=400, detail="Categoría inválida")
    if not data.content.strip():
        raise HTTPException(status_code=400, detail="El contenido no puede estar vacío")
    if len(data.content) > 1000:
        raise HTTPException(status_code=400, detail="Máximo 1000 caracteres")

    suggestion = Suggestion(
        user_id=user.id,
        category=data.category,
        content=data.content.strip(),
    )
    db.add(suggestion)
    db.commit()
    db.refresh(suggestion)

    # Push notification to admins
    try:
        from app.services.push_service import send_push_to_admins
        send_push_to_admins(
            db,
            f"Nueva sugerencia de {user.name}",
            f"[{data.category.upper()}] {data.content[:80]}",
            "/admin?tab=suggestions",
        )
    except Exception:
        pass

    return SuggestionResponse(
        id=suggestion.id,
        user_id=suggestion.user_id,
        user_name=user.name,
        category=suggestion.category,
        content=suggestion.content,
        status=suggestion.status,
        admin_reply=suggestion.admin_reply,
        created_at=suggestion.created_at,
    )


# ─── ADMIN ENDPOINTS ───────────────────────────────────────────────

@router.get("/admin/suggestions", response_model=list[SuggestionResponse])
def list_all_suggestions(
    status: str | None = None,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    query = db.query(Suggestion).join(User, Suggestion.user_id == User.id)
    if status:
        query = query.filter(Suggestion.status == status)
    suggestions = query.order_by(desc(Suggestion.created_at)).all()

    return [
        SuggestionResponse(
            id=s.id,
            user_id=s.user_id,
            user_name=s.user.name if s.user else "?",
            category=s.category,
            content=s.content,
            status=s.status,
            admin_reply=s.admin_reply,
            created_at=s.created_at,
        )
        for s in suggestions
    ]


@router.put("/admin/suggestions/{suggestion_id}", response_model=SuggestionResponse)
def update_suggestion(
    suggestion_id: int,
    data: SuggestionUpdate,
    admin: User = Depends(get_admin_user),
    db: Session = Depends(get_db),
):
    suggestion = db.query(Suggestion).filter(Suggestion.id == suggestion_id).first()
    if not suggestion:
        raise HTTPException(status_code=404, detail="Sugerencia no encontrada")

    if data.status is not None:
        if data.status not in ("pendiente", "visto", "implementado"):
            raise HTTPException(status_code=400, detail="Status inválido")
        suggestion.status = data.status
    if data.admin_reply is not None:
        suggestion.admin_reply = data.admin_reply.strip()

    db.commit()
    db.refresh(suggestion)

    # Notify user if admin replied
    if data.admin_reply:
        try:
            from app.services.push_service import send_push_to_user
            send_push_to_user(
                db,
                suggestion.user_id,
                "Respuesta a tu sugerencia",
                data.admin_reply[:100],
                "/suggestions",
            )
        except Exception:
            pass

    return SuggestionResponse(
        id=suggestion.id,
        user_id=suggestion.user_id,
        user_name=suggestion.user.name if suggestion.user else "?",
        category=suggestion.category,
        content=suggestion.content,
        status=suggestion.status,
        admin_reply=suggestion.admin_reply,
        created_at=suggestion.created_at,
    )
