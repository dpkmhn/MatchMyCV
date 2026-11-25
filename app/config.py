from functools import lru_cache
from pathlib import Path

from pydantic import SecretStr
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    groq_api_key: SecretStr | None = None
    groq_model_large: str = "openai/gpt-oss-120b"
    groq_model_small: str = "openai/gpt-oss-20b"

    # Times the optimizer may be sent back with the fabrication guard's feedback.
    max_revisions: int = 1
    # Inputs longer than this are rejected; we never truncate a resume silently.
    max_input_chars: int = 30_000
    max_upload_bytes: int = 5 * 1024 * 1024
    # Generated CVs and their edit history (one JSON file each).
    cv_dir: Path = Path("data/cvs")
    max_instruction_chars: int = 2000

    def missing_keys(self) -> list[str]:
        if not self.groq_api_key or not self.groq_api_key.get_secret_value():
            return ["GROQ_API_KEY"]
        return []


@lru_cache
def get_settings() -> Settings:
    return Settings()
