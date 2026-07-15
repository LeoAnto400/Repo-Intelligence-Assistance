import logging
import re
import time
import uuid
from functools import lru_cache
from typing import Any, Dict, List, Optional
from urllib.parse import urlparse

from fastapi import APIRouter, Depends, HTTPException, status
from starlette.concurrency import run_in_threadpool

from src.agents.analysis import AnalysisAgent
from src.agents.orchestrator import Orchestrator
from src.agents.retrieval import RetrievalAgent
from src.api.schemas import (
    IngestRequest,
    IngestResponse,
    QueryRequest,
    QueryResponse,
    RepositoryContextResponse,
)
from src.core.config import settings
from src.db.chroma import VectorStoreManager
from src.services.chunker import CodeChunker, CodeFile
from src.services.gemini import GeminiService
from src.services.github import GitHubService
from src.services.ingestion import filter_chunks_for_embedding

logger = logging.getLogger(__name__)

router = APIRouter()
_active_repository: Optional[str] = None
_active_repository_context: Optional[Dict[str, Any]] = None


class _TaggedLogAdapter(logging.LoggerAdapter):
    """Prefixes every log line with a short request-correlation tag, e.g.
    ``[ingest:3f9a2c1d]``, so every step of a single request can be grepped
    out of interleaved server logs even when requests overlap."""

    def process(self, msg, kwargs):
        return f"[{self.extra['tag']}] {msg}", kwargs


def _build_chunks(files: List[Dict[str, Any]], chunker: CodeChunker, repository: str) -> List:
    chunks = []
    for file_info in files:
        code_file = CodeFile(
            file_path=file_info["path"],
            content=file_info["content"],
            language=file_info["language"],
            metadata={"repository_id": repository},
        )
        chunks.extend(chunker.chunk_file(code_file))
    return chunks


def _store_chunks(
    vector_store: VectorStoreManager,
    repository: str,
    documents: List[str],
    embeddings: List[List[float]],
    metadatas: List[Dict[str, Any]],
    ids: List[str],
) -> None:
    vector_store.reset_collection(repository)
    vector_store.add_documents(
        collection_name=repository,
        documents=documents,
        embeddings=embeddings,
        metadatas=metadatas,
        ids=ids,
    )


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


def set_active_repository_context(context: Dict[str, Any]) -> None:
    global _active_repository_context
    _active_repository_context = context


def get_active_repository_context() -> Optional[Dict[str, Any]]:
    return _active_repository_context


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
    ingestion_id = uuid.uuid4().hex[:8]
    log = _TaggedLogAdapter(logger, {"tag": f"ingest:{ingestion_id}"})
    request_start = time.perf_counter()

    repo_url = payload.repo_url.strip() if payload.repo_url else ""
    validate_repo_url(repo_url)
    repository = collection_name_from_repo_url(repo_url)

    log.info("Ingestion start: repo_url=%s repository=%s", repo_url, repository)

    # ── Step 1: Clone + scan the repository ──────────────────────────────
    step_start = time.perf_counter()
    try:
        files = await run_in_threadpool(github_service.fetch_repo_files, repo_url)
    except ValueError as e:
        log.exception("Invalid repository URL during ingestion")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid repository URL: {e}",
        ) from e
    except Exception as e:
        log.exception("Repository clone/read failed during ingestion")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Repository clone/read failed: {e}",
        ) from e

    if not files:
        log.error("Repository ingestion produced no readable files")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No supported files were found in the repository.",
        )
    log.info(
        "Clone/scan complete: %d files in %.2fs", len(files), time.perf_counter() - step_start
    )

    # ── Step 2: Chunk every file ─────────────────────────────────────────
    step_start = time.perf_counter()
    try:
        all_chunks = await run_in_threadpool(_build_chunks, files, chunker, repository)
        embeddable_chunks = filter_chunks_for_embedding(all_chunks)
        if not embeddable_chunks:
            raise RuntimeError("No embeddable chunks were created from repository files.")
    except Exception as e:
        log.exception("Chunking failed during ingestion")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Repository chunking failed: {e}",
        ) from e
    log.info(
        "Chunking complete: %d chunks (from %d raw) in %.2fs",
        len(embeddable_chunks), len(all_chunks), time.perf_counter() - step_start
    )

    # ── Step 3: Generate embeddings via Gemini ───────────────────────────
    step_start = time.perf_counter()
    try:
        texts = [chunk.content for chunk in embeddable_chunks]
        embeddings = await run_in_threadpool(gemini_service.generate_embeddings_batch, texts)
    except Exception as e:
        log.exception("Embedding generation failed during ingestion")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Embedding generation failed: {e}",
        ) from e
    log.info(
        "Embedding generation complete: %d vectors in %.2fs",
        len(embeddings), time.perf_counter() - step_start
    )

    documents = [chunk.content for chunk in embeddable_chunks]
    ids = [chunk.chunk_id for chunk in embeddable_chunks]
    metadatas: List[Dict[str, Any]] = []
    for chunk in embeddable_chunks:
        metadata = dict(chunk.metadata)
        metadata["file_path"] = chunk.file_path
        metadata["chunk_type"] = chunk.chunk_type
        metadatas.append(metadata)

    # ── Step 4: Persist to ChromaDB ───────────────────────────────────────
    step_start = time.perf_counter()
    try:
        await run_in_threadpool(
            _store_chunks, vector_store, repository, documents, embeddings, metadatas, ids
        )
    except Exception as e:
        log.exception("ChromaDB storage failed during ingestion")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"ChromaDB storage failed: {e}",
        ) from e
    log.info("ChromaDB storage complete in %.2fs", time.perf_counter() - step_start)

    # ── Step 5: Fetch repository metadata/commits/PRs for the dashboard ──
    step_start = time.perf_counter()
    try:
        repository_context = await run_in_threadpool(
            github_service.fetch_repository_context, repo_url, files=files
        )
    except Exception as e:
        log.exception("GitHub repository metadata fetch failed during ingestion")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"GitHub repository metadata fetch failed: {e}",
        ) from e
    log.info("Repository metadata fetch complete in %.2fs", time.perf_counter() - step_start)

    # ── Step 6: Activate the ingested repository for /query and /repository ──
    try:
        set_active_repository(repository)
        set_active_repository_context(
            {
                "repository": repository,
                "repo_url": repo_url,
                **repository_context,
            }
        )
    except Exception as e:
        log.exception("Failed to activate ingested repository")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to activate ingested repository: {e}",
        ) from e

    log.info(
        "Ingestion complete: files_processed=%d chunks_created=%d total_time=%.2fs",
        len(files), len(embeddable_chunks), time.perf_counter() - request_start,
    )
    return IngestResponse(
        status="success",
        repository=repository,
        files_processed=len(files),
        chunks_created=len(embeddable_chunks),
        repo_url=repo_url,
    )


@router.get("/repository", response_model=RepositoryContextResponse)
async def get_repository_context() -> RepositoryContextResponse:
    context = get_active_repository_context()
    if not context:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No repository has been ingested yet.",
        )

    return RepositoryContextResponse(**context)


@router.post("/query", response_model=QueryResponse)
async def query_repository(
    payload: QueryRequest,
    orchestrator: Orchestrator = Depends(get_orchestrator),
) -> QueryResponse:
    query_id = uuid.uuid4().hex[:8]
    log = _TaggedLogAdapter(logger, {"tag": f"query:{query_id}"})
    request_start = time.perf_counter()

    question = payload.question.strip() if payload.question else ""
    log.info("Query start: question=%r", question)

    if not question:
        log.error("Query rejected because question was empty")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Question cannot be empty.",
        )

    try:
        result = await orchestrator.process(question)
    except ValueError as e:
        log.exception("Invalid query request")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(e),
        ) from e
    except RuntimeError as e:
        log.exception("Query orchestration failed")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e),
        ) from e
    except Exception as e:
        log.exception("Unexpected query failure")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Query failed: {e}",
        ) from e

    log.info(
        "Query complete: retrieved_chunks=%d total_time=%.2fs",
        result.retrieved_chunks, time.perf_counter() - request_start,
    )
    return QueryResponse(
        answer=result.answer,
        source_files=result.source_files,
        retrieved_chunks=result.retrieved_chunks,
    )
