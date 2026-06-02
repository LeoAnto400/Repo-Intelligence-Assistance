from fastapi import APIRouter, HTTPException, Depends
from src.api.schemas import IngestRequest, IngestResponse, QueryRequest, QueryResponse

router = APIRouter()

@router.post("/ingest", response_model=IngestResponse, status_code=202)
async def ingest_repository(payload: IngestRequest) -> IngestResponse:
    """
    Ingest a GitHub repository: downloads files, chunks code, 
    calculates embeddings using Gemini, and indexes them in ChromaDB.
    """
    # Placeholder: Not Implemented (501)
    raise HTTPException(
        status_code=501, 
        detail="Ingestion workflow is not implemented. Placeholder endpoint only."
    )

@router.post("/query", response_model=QueryResponse)
async def query_repository(payload: QueryRequest) -> QueryResponse:
    """
    Query the assistant regarding the ingested repository. Queries the 
    Chroma Vector database and compiles answers using Gemini LLM.
    """
    # Placeholder: Not Implemented (501)
    raise HTTPException(
        status_code=501, 
        detail="Multi-agent query coordination is not implemented. Placeholder endpoint only."
    )
