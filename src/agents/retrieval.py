import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional
from src.agents.base import BaseAgent
from src.db.chroma import VectorStoreManager
from src.services.gemini import GeminiService

logger = logging.getLogger(__name__)

@dataclass
class RetrievalResult:
    """
    Domain model representing a retrieved code chunk with similarity score and metadata.
    Does not expose database-specific client models to the outside.
    """
    chunk_id: str
    file_path: str
    content: str
    score: float
    metadata: Dict[str, Any]

    def to_dict(self) -> Dict[str, Any]:
        """
        Convert the RetrievalResult domain model instance into a standard dictionary.
        """
        return {
            "chunk_id": self.chunk_id,
            "file_path": self.file_path,
            "content": self.content,
            "score": self.score,
            "metadata": self.metadata
        }

class RetrievalAgent(BaseAgent):
    """
    RetrievalAgent locates and extracts relevant code segments from ChromaDB 
    using embeddings matching via the Gemini Embeddings API.
    """
    
    def __init__(
        self, 
        vector_store: VectorStoreManager, 
        gemini_service: GeminiService,
        default_top_k: int = 5
    ):
        """
        Initialize RetrievalAgent with dependencies.
        
        Args:
            vector_store: Instantiated vector database manager client wrapper.
            gemini_service: Instantiated service wrapper for calculating query embeddings.
            default_top_k: Fallback count of results to return when not overridden in query payload.
        """
        self.vector_store = vector_store
        self.gemini_service = gemini_service
        self.default_top_k = default_top_k
        logger.info("RetrievalAgent initialized with default_top_k=%d", default_top_k)

    async def process(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Query database and return relevant snippets as a structured dictionary.
        
        Expected payload format:
        {
            "query": str,
            "repository_id": str,
            "top_k": Optional[int]
        }
        
        Returns:
            Dict containing retrieved snippets (mapped to dictionary format) and status/error details.
            Example:
            {
                "results": [
                    {
                        "chunk_id": "...",
                        "file_path": "...",
                        "content": "...",
                        "score": 0.12,
                        "metadata": {...}
                    }
                ],
                "error": None
            }
        """
        logger.info("Processing retrieval agent task.")
        
        query = payload.get("query")
        repository_id = payload.get("repository_id")
        top_k = payload.get("top_k")
        
        # Payload validation
        if not query or not isinstance(query, str) or not query.strip():
            logger.error("Missing or invalid 'query' parameter in retrieval payload.")
            return {"results": [], "error": "Required field 'query' is missing or empty."}
        if not repository_id or not isinstance(repository_id, str) or not repository_id.strip():
            logger.error("Missing or invalid 'repository_id' parameter in retrieval payload.")
            return {"results": [], "error": "Required field 'repository_id' is missing or empty."}
            
        # Parse and validate top_k
        if top_k is not None:
            try:
                top_k_val = int(top_k)
                if top_k_val <= 0:
                    logger.warning("top_k must be a positive integer. Got %d. Using default %d.", top_k_val, self.default_top_k)
                    top_k_val = self.default_top_k
            except (ValueError, TypeError):
                logger.warning("Invalid top_k format. Got %s. Using default %d.", top_k, self.default_top_k)
                top_k_val = self.default_top_k
        else:
            top_k_val = self.default_top_k

        try:
            logger.debug("Executing retrieve_snippets for repository_id: %s, top_k: %d", repository_id, top_k_val)
            retrieved_objects = await self.retrieve_snippets(
                query=query.strip(),
                repository_id=repository_id.strip(),
                top_k=top_k_val
            )
            
            # Warn if no matching results were retrieved
            if not retrieved_objects:
                logger.info("No matching snippets retrieved for query: '%s' in repository_id: '%s'", query, repository_id)
                
            serialized_results = [obj.to_dict() for obj in retrieved_objects]
            return {"results": serialized_results, "error": None}
            
        except Exception as e:
            logger.exception("An exception occurred during retrieval process execution")
            return {"results": [], "error": f"Retrieval failed: {str(e)}"}

    async def retrieve_snippets(
        self, 
        query: str, 
        repository_id: str, 
        top_k: int = 5
    ) -> List[RetrievalResult]:
        """
        Internal retrieval helper containing embedding computation and Chroma DB query logic.
        
        Args:
            query: User search query.
            repository_id: Active collection/repository to filter on.
            top_k: Max matches to fetch.
            
        Returns:
            List of matching document blocks wrapped as RetrievalResult domain models.
        """
        logger.info("Starting snippet retrieval for query '%s' against repository '%s'", query, repository_id)
        
        # Step 1: Generate embedding for the search query
        try:
            logger.debug("Generating embedding for query using GeminiService")
            embedding = self.gemini_service.generate_embedding(query)
        except Exception as e:
            logger.error("Failed to generate embedding for query '%s': %s", query, e)
            raise RuntimeError(f"Embedding generation failed: {e}") from e

        # Future extensions hook: 
        # - Query metadata filtering (e.g. metadata filters key-values) can be integrated here.
        # - Hybrid search (combining sparse keyword retrieval with dense vector lookup) can be performed here.
        
        # Step 2: Query ChromaDB Persistent Vector database
        try:
            logger.debug("Querying vector store collection: %s", repository_id)
            db_results = self.vector_store.query_similarity(
                collection_name=repository_id,
                query_embedding=embedding,
                top_k=top_k
            )
        except Exception as e:
            logger.error("Failed to query vector database for collection '%s': %s", repository_id, e)
            raise RuntimeError(f"Vector database query failed: {e}") from e

        # Future extensions hook:
        # - Reranking mechanisms (e.g. cross-encoders, Cohere rerank) can be applied to `retrieved_results`
        #   prior to mapping and returning.
        
        # Step 3: Map database records to RetrievalResult domain models
        mapped_results: List[RetrievalResult] = []
        for res in db_results:
            chunk_id = res.get("id") or ""
            content = res.get("document") or ""
            
            score_val = res.get("distance")
            score = float(score_val) if score_val is not None else 0.0
            
            metadata = res.get("metadata") or {}
            
            # Robustly extract path from metadata dictionary keys
            file_path = metadata.get("file_path") or metadata.get("file") or metadata.get("path") or ""
            
            mapped_results.append(
                RetrievalResult(
                    chunk_id=chunk_id,
                    file_path=file_path,
                    content=content,
                    score=score,
                    metadata=metadata
                )
            )
            
        logger.debug("Mapped %d raw database records to RetrievalResult objects.", len(mapped_results))
        return mapped_results
