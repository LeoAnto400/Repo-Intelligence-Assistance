import logging

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from src.api.routes import router as api_router
from src.core.config import settings
from src.core.logging import configure_logging

configure_logging()
logger = logging.getLogger(__name__)

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="REST API for ingesting GitHub repositories and answering questions about their code.",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

# Allow the frontend dev server to call the API directly from the browser
# (the frontend no longer proxies through Next.js rewrites - see api-client.ts).
# In production, replace these origins with your actual frontend domain.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://192.168.1.7:3000",  # matches allowedDevOrigins in frontend/next.config.ts
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API routes
app.include_router(api_router, prefix=settings.API_V1_STR)


@app.exception_handler(Exception)
async def log_unhandled_exception(request: Request, exc: Exception) -> JSONResponse:
    """
    Last-resort safety net: log the full traceback and return a proper HTTP 500
    for any exception that escapes a route handler's own error handling,
    instead of letting the ASGI worker crash the connection outright.
    """
    logger.exception(
        "Unhandled exception in %s %s: %s", request.method, request.url.path, exc
    )
    return JSONResponse(
        status_code=500,
        content={"detail": f"Internal server error: {exc}"},
    )


@app.get("/health", tags=["Health"])
def health_check():
    """Service health check endpoint."""
    return {"status": "healthy"}

