from fastapi import FastAPI
from src.api.routes import router as api_router
from src.core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Multi-agent intelligence service for querying and understanding GitHub repositories.",
    version="0.1.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Register API routes
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/", tags=["Health"])
def health_check():
    """Service health check endpoint."""
    return {
        "status": "healthy",
        "project": settings.PROJECT_NAME,
        "api_prefix": settings.API_V1_STR
    }
