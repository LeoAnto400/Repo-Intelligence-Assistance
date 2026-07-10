import logging
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, TypedDict

from langgraph.graph import END, START, StateGraph

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
    Coordinates retrieval and analysis agents with a minimal LangGraph workflow.
    """

    def __init__(self, retrieval_agent: RetrievalAgent, analysis_agent: AnalysisAgent):
        self.retrieval_agent = retrieval_agent
        self.analysis_agent = analysis_agent
        self.last_state: Optional[AgentState] = None
        self._compiled_graph = self.compile_workflow_graph()
        logger.info("Orchestrator initialized.")

    def compile_workflow_graph(self) -> Any:
        graph = StateGraph(AgentState)
        graph.add_node("retrieve", self.retrieval_node)
        graph.add_node("analyze", self.analysis_node)
        graph.add_edge(START, "retrieve")
        graph.add_edge("retrieve", "analyze")
        graph.add_edge("analyze", END)
        return graph.compile()

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
            final_state = await self._compiled_graph.ainvoke(state)
        except Exception as e:
            if self.last_state and self.last_state.get("error"):
                raise RuntimeError(self.last_state["error"]) from e
            logger.exception("Orchestrator graph execution failed.")
            raise RuntimeError(f"Orchestrator graph execution failed: {e}") from e

        self.last_state = final_state
        state_error = final_state.get("error")
        if state_error:
            logger.error("Orchestrator graph completed with error: %s", state_error)
            raise RuntimeError(state_error)

        analysis_response = final_state.get("analysis_result")
        if not isinstance(analysis_response, dict):
            final_state["error"] = "Analysis node did not produce a valid analysis_result."
            self.last_state = final_state
            logger.error(final_state["error"])
            raise RuntimeError(final_state["error"])

        retrieval_results = final_state.get("retrieval_results") or []
        return OrchestratorResult(
            answer=analysis_response.get("answer", ""),
            source_files=analysis_response.get("source_files", []),
            retrieved_chunks=len(retrieval_results),
        )

    async def retrieval_node(self, state: AgentState) -> Dict[str, Any]:
        question = state.get("question", "")

        try:
            retrieval_response = await self.retrieval_agent.process({
                "query": question
            })
        except Exception as e:
            state["error"] = f"Retrieval agent failed: {e}"
            self.last_state = state
            logger.exception("RetrievalAgent.process raised during orchestration.")
            raise RuntimeError(state["error"]) from e

        retrieval_error = retrieval_response.get("error")
        if retrieval_error:
            state["error"] = f"Retrieval failed: {retrieval_error}"
            self.last_state = state
            logger.error("Retrieval failed during orchestration: %s", retrieval_error)
            raise RuntimeError(state["error"])

        retrieval_results = retrieval_response.get("results") or []
        if not isinstance(retrieval_results, list):
            state["error"] = "Retrieval agent returned invalid 'results'; expected a list."
            self.last_state = state
            logger.error(state["error"])
            raise RuntimeError(state["error"])

        state["retrieval_results"] = retrieval_results
        state["error"] = None
        self.last_state = state
        return {
            "retrieval_results": retrieval_results,
            "error": None,
        }

    async def analysis_node(self, state: AgentState) -> Dict[str, Any]:
        question = state.get("question", "")
        retrieval_results = state.get("retrieval_results") or []

        try:
            analysis_response = await self.analysis_agent.process({
                "question": question,
                "retrieval_results": retrieval_results,
            })
        except Exception as e:
            state["error"] = f"Analysis agent failed: {e}"
            self.last_state = state
            logger.exception("AnalysisAgent.process raised during orchestration.")
            raise RuntimeError(state["error"]) from e

        state["analysis_result"] = analysis_response
        analysis_error = analysis_response.get("error")
        if analysis_error:
            state["error"] = f"Analysis failed: {analysis_error}"
            self.last_state = state
            logger.error("Analysis failed during orchestration: %s", analysis_error)
            raise RuntimeError(state["error"])

        state["error"] = None
        self.last_state = state
        return {
            "analysis_result": analysis_response,
            "error": None,
        }
