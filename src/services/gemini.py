import logging
import os
from typing import List, Optional
import google.generativeai as genai
from src.core.config import settings

logger = logging.getLogger(__name__)

class GeminiService:
    """
    Handles API calls to Google's Gemini models for embedding generation 
    and prompt-based text synthesis.
    """
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Gemini API client with credentials.
        
        Args:
            api_key: Google Gemini API secret key. If not provided, will be loaded from 
                     environment variables or config settings.
        
        Raises:
            ValueError: If no API key is set.
        """
        self.api_key = api_key or os.environ.get("GEMINI_API_KEY") or settings.GEMINI_API_KEY
        if not self.api_key:
            logger.error("Gemini API Key is missing.")
            raise ValueError(
                "Gemini API key is required. Please set the GEMINI_API_KEY environment variable "
                "or define it in settings."
            )
        
        logger.info("Initializing Gemini service client.")
        genai.configure(api_key=self.api_key)
        self._client = genai

    def generate_embedding(self, text: str, model: str = "models/text-embedding-004") -> List[float]:
        """
        Convert raw text into high-dimensional vector embeddings.
        
        Args:
            text: Code snippet or paragraph to embed.
            model: Embedding model name.
            
        Returns:
            List of float values representing the embedding vector.
            
        Raises:
            ValueError: If the text is empty or invalid.
            RuntimeError: If the API call fails.
        """
        if not text or not text.strip():
            logger.error("Text input for embedding cannot be empty.")
            raise ValueError("Text input for embedding cannot be empty.")

        try:
            logger.debug("Generating embedding for text using model %s", model)
            response = self._client.embed_content(
                model=model,
                content=text,
                task_type="retrieval_document"
            )
            if "embedding" not in response:
                logger.error("API response did not contain 'embedding' key: %s", response)
                raise RuntimeError("Invalid API response format: 'embedding' key not found.")
            
            return response["embedding"]
        except Exception as e:
            logger.exception("Failed to generate embedding due to API error")
            raise RuntimeError(f"Failed to generate embedding: {e}") from e

    def generate_embeddings_batch(self, texts: List[str], model: str = "models/text-embedding-004") -> List[List[float]]:
        """
        Convert multiple texts into high-dimensional vector embeddings in batch.
        
        Args:
            texts: List of code snippets or paragraphs to embed.
            model: Embedding model name.
            
        Returns:
            List of lists of float values representing the embedding vectors.
            
        Raises:
            ValueError: If the texts list is empty or contains empty text.
            RuntimeError: If the API call fails.
        """
        if not texts:
            logger.error("Texts batch list cannot be empty.")
            raise ValueError("Texts batch list cannot be empty.")
        
        for idx, text in enumerate(texts):
            if not text or not text.strip():
                logger.error("Text at batch index %d is empty.", idx)
                raise ValueError(f"Text at batch index {idx} cannot be empty.")

        try:
            logger.info("Generating embeddings for batch of %d items using model %s", len(texts), model)
            response = self._client.embed_content(
                model=model,
                content=texts,
                task_type="retrieval_document"
            )
            if "embedding" not in response:
                logger.error("API response did not contain 'embedding' key: %s", response)
                raise RuntimeError("Invalid API response format: 'embedding' key not found.")
            
            embeddings = response["embedding"]
            if not isinstance(embeddings, list) or (embeddings and not isinstance(embeddings[0], list)):
                logger.error("Returned embeddings are not a list of lists: %s", type(embeddings))
                raise RuntimeError("Returned embeddings from API did not match expected list-of-lists format.")

            return embeddings
        except Exception as e:
            logger.exception("Failed to generate batch embeddings due to API error")
            raise RuntimeError(f"Failed to generate batch embeddings: {e}") from e

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
            
        Raises:
            ValueError: If prompt is empty.
            RuntimeError: If LLM call fails.
        """
        if not prompt or not prompt.strip():
            logger.error("Prompt cannot be empty.")
            raise ValueError("Prompt cannot be empty.")
            
        try:
            logger.info("Generating content with model %s", model)
            generative_model = self._client.GenerativeModel(
                model_name=model,
                system_instruction=system_instruction
            )
            response = generative_model.generate_content(prompt)
            return response.text
        except Exception as e:
            logger.exception("Failed to generate content: %s", e)
            raise RuntimeError(f"Failed to generate content: {e}") from e

