from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./dev.db"  # override with Postgres DSN in production
    jwt_secret: str = "dev-only-secret-change-me"
    jwt_expire_minutes: int = 720  # admin sessions
    customer_token_days: int = 30  # customer (website) sessions
    admin_email: str = "admin@example.com"
    admin_password: str = "change-me-now"
    cors_origins: str = "http://localhost:5173"
    public_site_url: str = "http://localhost:5173"  # used for sitemap.xml and canonical URLs
    public_api_url: str = "http://localhost:8000"  # base URL used to build media links
    media_dir: str = "media"  # where uploaded images are stored
    media_max_mb: int = 8

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
