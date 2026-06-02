from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    """
    Application settings loaded from environment variables and/or a .env file.
    """
    PROJECT_NAME: str = "GitHub Repository Intelligence Assistant"
    API_V1_STR: str = "/api/v1"
    
    # API Keys & Credentials
    GEMINI_API_KEY: str = Field("", description="Google Gemini API Key for LLM and embeddings generation")
    GITHUB_TOKEN: str | None = Field(None, description="GitHub personal access token (optional, for higher rate limits)")
    
    # Vector Database
    CHROMA_DB_DIR: str = Field("./chroma_db", description="Local directory path where ChromaDB collections are stored")
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
