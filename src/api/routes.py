import logging
import re
from functools import lru_cache
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, status

from src.agents.analysis import AnalysisAgent
from src.agents.orchestrator import Orchestrator
from src.agents.retrieval import RetrievalAgent
from src.api.schemas import IngestRequest, IngestResponse, QueryRequest, QueryResponse
from src.core.config import settings
from src.db.chroma import VectorStoreManager
from src.services.chunker import CodeChunker, CodeFile
from src.services.gemini import GeminiService
from src.services.github import GitHubService
from src.services.ingestion import filter_chunks_for_embedding

logger = logging.getLogger(__name__)

router = APIRouter()
_active_repository: Optional[str] = None


def collection_name_from_repo_url(repo_url: str) -> str:
    repo_name_clean = re.sub(r"[^a-zA-Z0-9_-]", "_", repo_url.rstrip("/").split("/")[-1])
    repo_name_clean = re.sub(r"_+", "_", repo_name_clean).strip("_")
    if len(repo_name_clean) < 3:
        repo_name_clean = "repo_collection"
    return repo_name_clean[:60]


def validate_repo_url(repo_url: str) -> None:
    parsed = urlparse(repo_url)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc or not parsed.path.strip("/"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid repository URL.",
        )


def set_active_repository(repository: str) -> None:
    global _active_repository
    _active_repository = repository


def get_active_repository() -> Optional[str]:
    return _active_repository


@lru_cache(maxsize=1)
def get_github_service() -> GitHubService:
    return GitHubService(token=settings.GITHUB_TOKEN)


@lru_cache(maxsize=1)
def get_chunker() -> CodeChunker:
    return CodeChunker()


@lru_cache(maxsize=1)
def get_gemini_service() -> GeminiService:
    return GeminiService()


@lru_cache(maxsize=1)
def get_vector_store() -> VectorStoreManager:
    return VectorStoreManager(db_path=settings.CHROMA_DB_DIR)


@lru_cache(maxsize=1)
def get_retrieval_agent() -> RetrievalAgent:
    return RetrievalAgent(
        vector_store=get_vector_store(),
        gemini_service=get_gemini_service(),
    )


@lru_cache(maxsize=1)
def get_analysis_agent() -> AnalysisAgent:
    return AnalysisAgent(gemini_service=get_gemini_service())


class ActiveRepositoryRetrievalAgent:
    """
    API-layer adapter that supplies the current ingested repository to RetrievalAgent.
    """

    def __init__(self, retrieval_agent: RetrievalAgent):
        self.retrieval_agent = retrieval_agent

    async def process(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        repository = get_active_repository()
        if not repository:
            return {
                "results": [],
                "error": "No repository has been ingested yet.",
            }

        scoped_payload = dict(payload)
        scoped_payload.setdefault("repository_id", repository)
        return await self.retrieval_agent.process(scoped_payload)


@lru_cache(maxsize=1)
def get_orchestrator() -> Orchestrator:
    return Orchestrator(
        retrieval_agent=ActiveRepositoryRetrievalAgent(get_retrieval_agent()),
        analysis_agent=get_analysis_agent(),
    )


@router.post("/ingest", response_model=IngestResponse, status_code=status.HTTP_200_OK)
async def ingest_repository(
    payload: IngestRequest,
    github_service: GitHubService = Depends(get_github_service),
    chunker: CodeChunker = Depends(get_chunker),
    gemini_service: GeminiService = Depends(get_gemini_service),
    vector_store: VectorStoreManager = Depends(get_vector_store),
) -> IngestResponse:
    repo_url = payload.repo_url.strip() if payload.repo_url else ""
    validate_repo_url(repo_url)
    repository = collection_name_from_repo_url(repo_url)

    logger.info(
        "Ingestion start",
        extra={"repo_url": repo_url, "repository": repository},
    )

    try:
        files = github_service.fetch_repo_files(repo_url)
    except ValueError as e:
        logger.exception("Invalid repository URL during ingestion")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid repository URL: {e}",
        ) from e
    except Exception as e:
        logger.exception("Repository clone/read failed during ingestion")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Repository clone/read failed: {e}",
        ) from e

    if not files:
        logger.error("Repository ingestion produced no readable files", extra={"repository": repository})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No supported files were found in the repository.",
        )

    all_chunks = []
    try:
        for file_info in files:
            code_file = CodeFile(
                file_path=file_info["path"],
                content=file_info["content"],
                language=file_info["language"],
                metadata={"repository_id": repository},
            )
            all_chunks.extend(chunker.chunk_file(code_file))

        embeddable_chunks = filter_chunks_for_embedding(all_chunks)
        if not embeddable_chunks:
            raise RuntimeError("No embeddable chunks were created from repository files.")
    except Exception as e:
        logger.exception("Chunking failed during ingestion")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Repository chunking failed: {e}",
        ) from e

    try:
        texts = [chunk.content for chunk in embeddable_chunks]
        embeddings = gemini_service.generate_embeddings_batch(texts)
    except Exception as e:
        logger.exception("Embedding generation failed during ingestion")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Embedding generation failed: {e}",
        ) from e

    documents = [chunk.content for chunk in embeddable_chunks]
    ids = [chunk.chunk_id for chunk in embeddable_chunks]
    metadatas: List[Dict[str, Any]] = []
    for chunk in embeddable_chunks:
        metadata = dict(chunk.metadata)
        metadata["file_path"] = chunk.file_path
        metadata["chunk_type"] = chunk.chunk_type
        metadatas.append(metadata)

    try:
        vector_store.reset_collection(repository)
        vector_store.add_documents(
            collection_name=repository,
            documents=documents,
            embeddings=embeddings,
            metadatas=metadatas,
            ids=ids,
        )
    except Exception as e:
        logger.exception("ChromaDB storage failed during ingestion")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ChromaDB storage failed: {e}",
        ) from e

    set_active_repository(repository)
    logger.info(
        "Ingestion complete",
        extra={
            "repository": repository,
            "files_processed": len(files),
            "chunks_created": len(embeddable_chunks),
        },
    )
    return IngestResponse(
        status="success",
        repository=repository,
        files_processed=len(files),
        chunks_created=len(embeddable_chunks),
    )


@router.post("/query", response_model=QueryResponse)
async def query_repository(
    payload: QueryRequest,
    orchestrator: Orchestrator = Depends(get_orchestrator),
) -> QueryResponse:
    question = payload.question.strip() if payload.question else ""
    logger.info("Query start", extra={"question": question})

    if not question:
        logger.error("Query rejected because question was empty")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty.",
        )

    try:
        result = await orchestrator.process(question)
    except ValueError as e:
        logger.exception("Invalid query request")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except RuntimeError as e:
        logger.exception("Query orchestration failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e
    except Exception as e:
        logger.exception("Unexpected query failure")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Query failed: {e}",
        ) from e

    logger.info(
        "Query complete",
        extra={"retrieved_chunks": result.retrieved_chunks},
    )
    return QueryResponse(
        answer=result.answer,
        source_files=result.source_files,
        retrieved_chunks=result.retrieved_chunks,
    )
