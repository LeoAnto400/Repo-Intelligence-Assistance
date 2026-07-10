import logging
from dataclasses import dataclass
from typing import Any, Dict, List

from src.agents.base import BaseAgent
from src.agents.retrieval import RetrievalResult
from src.services.gemini import GeminiService

logger = logging.getLogger(__name__)


@dataclass
class AnalysisResult:
    """
    Domain model for a synthesized repository answer and its supporting context.
    """
    answer: str
    source_files: List[str]
    chunk_count: int

    def to_dict(self) -> Dict[str, Any]:
        return {
            "answer": self.answer,
            "source_files": self.source_files,
            "chunk_count": self.chunk_count
        }


class AnalysisAgent(BaseAgent):
    """
    AnalysisAgent generates natural language explanations from retrieved code chunks.
    """

    def __init__(self, gemini_service: GeminiService):
        """
        Initialize AnalysisAgent with dependencies.

        Args:
            gemini_service: Service wrapper for prompt generations using Gemini LLM models.
        """
        self.gemini_service = gemini_service
        logger.info("AnalysisAgent initialized.")

    async def process(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze retrieved repository context against a user question.

        Expected payload format:
        {
            "question": str,  # "query" is also accepted for compatibility
            "retrieval_results": List[RetrievalResult | Dict[str, Any]]
        }

        Returns:
            Dict containing answer, source_files, chunk_count, and error.
        """
        logger.info("Processing analysis agent task.")

        question = payload.get("question") or payload.get("query")
        raw_results = payload.get("retrieval_results")
        if raw_results is None:
            raw_results = payload.get("retrieved_context")
        if raw_results is None:
            raw_results = payload.get("results")

        if not question or not isinstance(question, str) or not question.strip():
            logger.error("Missing or invalid question in analysis payload.")
            return {
                "answer": "",
                "source_files": [],
                "chunk_count": 0,
                "error": "Required field 'question' is missing or empty."
            }

        if raw_results is None or not isinstance(raw_results, list):
            logger.error("Missing or invalid retrieval results in analysis payload.")
            return {
                "answer": "",
                "source_files": [],
                "chunk_count": 0,
                "error": "Required field 'retrieval_results' must be a list."
            }

        try:
            retrieval_results = self._normalize_retrieval_results(raw_results)
            result = await self.generate_analysis(question.strip(), retrieval_results)
            return {**result.to_dict(), "error": None}
        except Exception as e:
            logger.exception("An exception occurred during analysis process execution")
            return {
                "answer": "",
                "source_files": [],
                "chunk_count": 0,
                "error": f"Analysis failed: {str(e)}"
            }

    async def generate_analysis(
        self,
        question: str,
        retrieval_results: List[RetrievalResult]
    ) -> AnalysisResult:
        """
        Generate a natural language explanation from retrieved repository chunks.

        Args:
            question: Question asked by the user.
            retrieval_results: Retrieved code chunks to use as the only answer context.

        Returns:
            AnalysisResult containing the answer and source summary.
        """
        logger.info(
            "Generating analysis for question using %d retrieved chunks.",
            len(retrieval_results)
        )

        context = self._build_context_block(retrieval_results)
        prompt = self._build_prompt(question, context)
        logger.debug("Calling GeminiService.generate_content for analysis.")

        answer = self.gemini_service.generate_content(prompt)
        source_files = self._source_files(retrieval_results)

        logger.info(
            "Analysis generated successfully. chunk_count=%d, source_file_count=%d",
            len(retrieval_results),
            len(source_files)
        )
        return AnalysisResult(
            answer=answer,
            source_files=source_files,
            chunk_count=len(retrieval_results)
        )

    def _normalize_retrieval_results(self, raw_results: List[Any]) -> List[RetrievalResult]:
        retrieval_results: List[RetrievalResult] = []

        for index, raw_result in enumerate(raw_results):
            if isinstance(raw_result, RetrievalResult):
                retrieval_results.append(raw_result)
                continue

            if not isinstance(raw_result, dict):
                raise ValueError(f"Retrieval result at index {index} must be a RetrievalResult or dict.")

            metadata = raw_result.get("metadata") or {}
            file_path = (
                raw_result.get("file_path")
                or metadata.get("file_path")
                or metadata.get("file")
                or metadata.get("path")
                or ""
            )
            retrieval_results.append(
                RetrievalResult(
                    chunk_id=raw_result.get("chunk_id") or raw_result.get("id") or "",
                    file_path=file_path,
                    content=raw_result.get("content") or raw_result.get("document") or "",
                    score=float(raw_result.get("score", 0.0) or 0.0),
                    metadata=metadata
                )
            )

        return retrieval_results

    def _build_context_block(self, retrieval_results: List[RetrievalResult]) -> str:
        if not retrieval_results:
            return "No repository context was retrieved."

        context_blocks: List[str] = []
        for index, result in enumerate(retrieval_results, start=1):
            metadata = result.metadata or {}
            chunk_type = metadata.get("chunk_type") or "unknown"
            name = metadata.get("name") or ""
            start_line = metadata.get("start_line")
            end_line = metadata.get("end_line")
            line_range = ""
            if start_line is not None and end_line is not None:
                line_range = f":{start_line}-{end_line}"

            heading_parts = [
                f"[Chunk {index}]",
                f"file={result.file_path or 'unknown'}{line_range}",
                f"type={chunk_type}"
            ]
            if name:
                heading_parts.append(f"name={name}")

            context_blocks.append(
                "\n".join([
                    " | ".join(heading_parts),
                    result.content
                ])
            )

        return "\n\n".join(context_blocks)

    def _build_prompt(self, question: str, context: str) -> str:
        return (
            "You are a senior software engineer.\n\n"
            "Answer the user's question using ONLY the provided repository context.\n\n"
            "If the answer cannot be determined from the context, say so.\n\n"
            "Repository Context:\n"
            f"{context}\n\n"
            "Question:\n"
            f"{question}"
        )

    def _source_files(self, retrieval_results: List[RetrievalResult]) -> List[str]:
        seen = set()
        source_files: List[str] = []

        for result in retrieval_results:
            if result.file_path and result.file_path not in seen:
                seen.add(result.file_path)
                source_files.append(result.file_path)

        return source_files
