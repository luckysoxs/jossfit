from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "JOSSFITness"
    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/fitness_jos"
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    ALGORITHM: str = "HS256"
    # 30 dias. No hay refresh token, asi que al vencer la app saca al
    # usuario y lo manda al login. Con 24 horas eso pasaba a diario.
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 43200

    # VAPID keys for Web Push notifications
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_MAILTO: str = "mailto:admin@jossfit.pro"

    class Config:
        env_file = ".env"


settings = Settings()
