from pydantic import BaseModel, HttpUrl
from typing import List, Dict, Any, Optional

class IngestRequest(BaseModel):
    """Payload to request ingestion and indexing of a repository."""
    repository_url: HttpUrl

class IngestResponse(BaseModel):
    """Response returned upon successfully queueing or initiating repository ingestion."""
    repository_id: str
    status: str
    message: str

class QueryRequest(BaseModel):
    """Payload to run a query against a previously ingested repository."""
    repository_id: str
    query: str

class QueryResponse(BaseModel):
    """Response returned after processing a repository intelligence query."""
    repository_id: str
    query: str
    answer: str
    sources: Optional[List[Dict[str, Any]]] = None
