import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, TypedDict

from src.agents.analysis import AnalysisAgent
from src.agents.base import BaseAgent
from src.agents.retrieval import RetrievalAgent

logger = logging.getLogger(__name__)


class AgentState(TypedDict):
    """
    Runtime state for the first non-LangGraph orchestrator workflow.
    """
    question: str
    retrieval_results: List[Dict[str, Any]]
    analysis_result: Optional[Dict[str, Any]]
    error: Optional[str]


@dataclass
class OrchestratorResult:
    answer: str
    source_files: List[str]
    retrieved_chunks: int


class Orchestrator(BaseAgent):
    """
    Coordinates retrieval and analysis agents without introducing LangGraph yet.
    """

    def __init__(self, retrieval_agent: RetrievalAgent, analysis_agent: AnalysisAgent):
        self.retrieval_agent = retrieval_agent
        self.analysis_agent = analysis_agent
        self.last_state: Optional[AgentState] = None
        logger.info("Orchestrator initialized.")

    async def process(self, question: str) -> OrchestratorResult:
        """
        Run retrieval followed by analysis for a user question.
        """
        state: AgentState = {
            "question": question,
            "retrieval_results": [],
            "analysis_result": None,
            "error": None,
        }
        self.last_state = state

        if not question or not isinstance(question, str) or not question.strip():
            state["error"] = "Question cannot be empty."
            logger.error("Orchestrator received an empty or invalid question.")
            raise ValueError(state["error"])

        normalized_question = question.strip()
        state["question"] = normalized_question

        try:
            retrieval_response = await self.retrieval_agent.process({
                "query": normalized_question
            })
        except Exception as e:
            state["error"] = f"Retrieval agent failed: {e}"
            logger.exception("RetrievalAgent.process raised during orchestration.")
            raise RuntimeError(state["error"]) from e

        retrieval_error = retrieval_response.get("error")
        if retrieval_error:
            state["error"] = f"Retrieval failed: {retrieval_error}"
            logger.error("Retrieval failed during orchestration: %s", retrieval_error)
            raise RuntimeError(state["error"])

        retrieval_results = retrieval_response.get("results") or []
        if not isinstance(retrieval_results, list):
            state["error"] = "Retrieval agent returned invalid 'results'; expected a list."
            logger.error(state["error"])
            raise RuntimeError(state["error"])
        state["retrieval_results"] = retrieval_results

        try:
            analysis_response = await self.analysis_agent.process({
                "question": normalized_question,
                "retrieval_results": retrieval_results,
            })
        except Exception as e:
            state["error"] = f"Analysis agent failed: {e}"
            logger.exception("AnalysisAgent.process raised during orchestration.")
            raise RuntimeError(state["error"]) from e

        state["analysis_result"] = analysis_response
        analysis_error = analysis_response.get("error")
        if analysis_error:
            state["error"] = f"Analysis failed: {analysis_error}"
            logger.error("Analysis failed during orchestration: %s", analysis_error)
            raise RuntimeError(state["error"])

        return OrchestratorResult(
            answer=analysis_response.get("answer", ""),
            source_files=analysis_response.get("source_files", []),
            retrieved_chunks=len(retrieval_results),
        )
