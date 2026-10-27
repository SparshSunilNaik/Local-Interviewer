from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="LOCAL_INTERVIEWER_", env_file=".env")

    host: str = "127.0.0.1"
    port: int = 8000
    data_dir: Path = Path("data")
    frontend_origin: str = "http://127.0.0.1:5173"
    max_upload_mb: int = 10

    @property
    def database_url(self) -> str:
        self.data_dir.mkdir(parents=True, exist_ok=True)
        return f"sqlite+aiosqlite:///{self.data_dir / 'local-interviewer.db'}"


settings = Settings()
