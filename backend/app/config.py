from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    APP_NAME: str = "Fitness Jos"
    DATABASE_URL: str = "postgresql://postgres:postgres@db:5432/fitness_jos"
    SECRET_KEY: str = "change-me-in-production-use-a-long-random-string"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    class Config:
        env_file = ".env"


settings = Settings()
