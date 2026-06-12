import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Database
    DATABASE_URL: str = os.getenv(
        "DATABASE_URL",
        "postgresql+asyncpg://user:password@localhost:5432/delivereat"
    )
    
    # Redis
    REDIS_URL: str = os.getenv("REDIS_URL", "redis://localhost:6379")
    
    # API Security
    INTERNAL_API_SECRET: str = os.getenv("INTERNAL_API_SECRET", "dev-secret")
    
    # Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", 8000))
    
    # Environment
    ENV: str = os.getenv("NODE_ENV", "development")
    DEBUG: bool = ENV == "development"
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
