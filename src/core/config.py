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
    GEMINI_EMBEDDING_BATCH_SIZE: int = Field(8, description="Maximum number of chunks to send per Gemini embedding request")
    GEMINI_EMBEDDING_MAX_BATCH_CHARS: int = Field(12000, description="Maximum total characters to send per Gemini embedding request")
    GEMINI_EMBEDDING_BATCH_DELAY_SECONDS: float = Field(0.5, description="Delay between Gemini embedding sub-batches")
    
    # Vector Database
    CHROMA_DB_DIR: str = Field("./chroma_db", description="Local directory path where ChromaDB collections are stored")
    
    class Config:
        env_file = ".env"
        case_sensitive = True

settings = Settings()
