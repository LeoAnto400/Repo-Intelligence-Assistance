from typing import List, Optional

class GeminiService:
    """
    Handles API calls to Google's Gemini models for embedding generation 
    and prompt-based text synthesis.
    """
    
    def __init__(self, api_key: str):
        """
        Initialize the Gemini API client with credentials.
        
        Args:
            api_key: Google Gemini API secret key.
        """
        self.api_key = api_key
        self._client = None  # Placeholder for google-generativeai client

    def generate_embedding(self, text: str, model: str = "models/text-embedding-004") -> List[float]:
        """
        Convert raw text into high-dimensional vector embeddings.
        
        Args:
            text: Code snippet or paragraph to embed.
            model: Embedding model name.
            
        Returns:
            List of float values representing the embedding vector.
        """
        raise NotImplementedError("GeminiService.generate_embedding is not implemented.")

    def generate_content(
        self, 
        prompt: str, 
        system_instruction: Optional[str] = None, 
        model: str = "gemini-2.5-flash"
    ) -> str:
        """
        Run generation using the LLM with option for system instructions.
        
        Args:
            prompt: Main user-facing query prompt.
            system_instruction: Guidelines/instructions to set model role/behavior.
            model: Target Gemini LLM model name.
            
        Returns:
            Generated response content as a string.
        """
        raise NotImplementedError("GeminiService.generate_content is not implemented.")
