from typing import Any, Dict, List, Optional

from pydantic import BaseModel

class IngestRequest(BaseModel):
    """Payload to request ingestion and indexing of a repository."""
    repo_url: str

class IngestResponse(BaseModel):
    """Response returned after repository ingestion completes."""
    status: str
    repository: str
    files_processed: int
    chunks_created: int
    repo_url: Optional[str] = None

class QueryRequest(BaseModel):
    """Payload to run a query against a previously ingested repository."""
    question: str

class QueryResponse(BaseModel):
    """Response returned after processing a repository intelligence query."""
    answer: str
    source_files: List[str]
    retrieved_chunks: int

class RepositorySummary(BaseModel):
    """Summary of a repository already indexed in the vector store, for the repo picker."""
    repository: str
    repo_url: Optional[str] = None
    chunk_count: int = 0

class CommitSummaryResponse(BaseModel):
    """AI-generated plain-English summary of a single commit."""
    hash: str
    summary: str

class RepositoryContextResponse(BaseModel):
    """Repository metadata and source snapshot for the active ingested repository."""
    repository: str
    repo_url: str
    metadata: Dict[str, Any]
    files: List[Dict[str, Any]]
    commits: List[Dict[str, Any]]
    pull_requests: List[Dict[str, Any]]
