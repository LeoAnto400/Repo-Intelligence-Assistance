from typing import Any, Dict, List
from src.agents.base import BaseAgent
from src.services.gemini import GeminiService

class AnalysisAgent(BaseAgent):
    """
    AnalysisAgent synthesizes deep explanations, structures functionality overviews,
    and formats responses based on the query and retrieved code snippet contexts.
    """
    
    def __init__(self, gemini_service: GeminiService):
        """
        Initialize AnalysisAgent with dependencies.
        
        Args:
            gemini_service: Service wrapper for prompt generations using Gemini LLM models.
        """
        self.gemini_service = gemini_service

    async def process(self, payload: Dict[str, Any]) -> Dict[str, Any]:
        """
        Analyze code context against a query.
        
        Expected payload format:
        {
            "query": str,
            "retrieved_context": List[Dict[str, Any]]
        }
        
        Returns:
            Dict containing synthesized analysis report or answer.
        """
        raise NotImplementedError("AnalysisAgent.process is not implemented.")

    async def generate_analysis(self, query: str, contexts: List[Dict[str, Any]]) -> str:
        """
        Interacts with Gemini API to construct response with code context.
        
        Args:
            query: Question asked by the user.
            contexts: List of file blocks containing snippets and metadata.
            
        Returns:
            Synthesized plain text markdown response.
        """
        raise NotImplementedError("AnalysisAgent.generate_analysis is not implemented.")
