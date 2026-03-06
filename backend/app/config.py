from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "JOSSFITness"
    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/fitness_jos"
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # VAPID keys for Web Push notifications
    VAPID_PUBLIC_KEY: str = ""
    VAPID_PRIVATE_KEY: str = ""
    VAPID_MAILTO: str = "mailto:admin@jossfit.pro"

    class Config:
        env_file = ".env"


settings = Settings()
