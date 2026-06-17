from typing import List

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

class QueryRequest(BaseModel):
    """Payload to run a query against a previously ingested repository."""
    question: str

class QueryResponse(BaseModel):
    """Response returned after processing a repository intelligence query."""
    answer: str
    source_files: List[str]
    retrieved_chunks: int
