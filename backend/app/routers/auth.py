from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.user import User
from app.schemas.user import UserCreate, UserLogin, Token, UserResponse
from app.auth.security import hash_password, verify_password, create_access_token, get_current_user
from app.services.push_service import send_push_to_admins

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(data: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.email,
        password_hash=hash_password(data.password),
        name=data.name,
        age=data.age,
        sex=data.sex,
        height_cm=data.height_cm,
        weight_kg=data.weight_kg,
        training_level=data.training_level,
        fitness_goal=data.fitness_goal,
        phone=data.phone,
        country_code=data.country_code,
        accent_color=data.accent_color,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    try:
        send_push_to_admins(
            db,
            title="Nuevo usuario registrado",
            body=f"{user.name} se acaba de registrar en JOSSFITness",
            url="/admin",
        )
    except Exception:
        pass  # Don't block registration if push fails

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, user=UserResponse.model_validate(user))


@router.get("/me", response_model=UserResponse)
def get_me(user: User = Depends(get_current_user)):
    return UserResponse.model_validate(user)

@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_access_token({"sub": str(user.id)})
    return Token(access_token=token, user=UserResponse.model_validate(user))
