from functools import lru_cache
from typing import Annotated, Literal

from pydantic import field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

Environment = Literal["development", "staging", "production"]


class Settings(BaseSettings):
    """Settings come from the environment (or a local .env), never from code."""

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    environment: Environment = "development"
    database_url: str = "postgresql+asyncpg://projectone:projectone@localhost:9667/projectone"
    # NoDecode: hand the raw comma-separated string to _split_origins instead of parsing it as JSON
    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:9555"]
    version: str = "0.1.0"
    # A session ends after this long without activity, and in any case this long after sign-in
    session_idle_minutes: int = 30
    session_max_hours: int = 12
    # Failed sign-ins allowed per email, and per address, within the window before further attempts are refused
    login_window_minutes: int = 15
    login_max_failures_per_email: int = 5
    login_max_failures_per_ip: int = 20
    # The starting password every engineer account is given (and reset to). Environment only, never in the repository;
    # the database holds only its hash. Unset means engineer accounts cannot be created or reset.
    default_engineer_password: str | None = None
    # Checklist evidence limits: the one place to change them (the screens read them from the API)
    evidence_max_mb: int = 10
    evidence_max_files: int = 5

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

    @property
    def evidence_max_bytes(self) -> int:
        return self.evidence_max_mb * 1024 * 1024

    @property
    def secure_cookies(self) -> bool:
        """Staging and production are served over HTTPS, so the session cookie is never sent over plain HTTP there."""
        return not self.is_development


@lru_cache
def get_settings() -> Settings:
    return Settings()
