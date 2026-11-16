from functools import lru_cache
from typing import Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

Environment = Literal["development", "staging", "production"]


class Settings(BaseSettings):
    """Settings come from the environment (or a local .env), never from code."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Environment = "development"
    database_url: str = "postgresql+asyncpg://projectone:projectone@localhost:9667/projectone"
    cors_origins: list[str] = ["http://localhost:9555"]
    version: str = "0.1.0"

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: object) -> object:
        if isinstance(value, str):
            return [item.strip() for item in value.split(",") if item.strip()]
        return value

    @property
    def is_development(self) -> bool:
        """The development-only tools and the stand-in sign-in exist only when this is true."""
        return self.environment == "development"


@lru_cache
def get_settings() -> Settings:
    return Settings()
