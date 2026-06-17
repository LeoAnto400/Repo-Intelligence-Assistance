from fastapi import FastAPI
from src.api.routes import router as api_router
from src.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="REST API for ingesting GitHub repositories and answering questions about their code.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Register API routes
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/health", tags=["Health"])
def health_check():
    """Service health check endpoint."""
    return {"status": "healthy"}
