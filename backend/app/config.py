from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    supabase_url: str
    supabase_service_key: str
    jina_api_key: str
    groq_api_key: str
    serper_api_key: str = ""
    daily_upload_limit: int = 10
    daily_question_limit: int = 100
    frontend_url: str = "http://localhost:3000"

    class Config:
        env_file = ".env"


settings = Settings()
