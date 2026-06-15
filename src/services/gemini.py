import logging
import os
import random
import time
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

    def _call_with_retry(self, func, *args, **kwargs):
        """
        Execute API call with exponential backoff on 429 rate limit or quota errors.
        """
        max_retries = 6
        delay = 2.0
        for attempt in range(max_retries):
            try:
                return func(*args, **kwargs)
            except Exception as e:
                err_msg = str(e)
                err_msg_lower = err_msg.lower()
                is_rate_limit = (
                    "429" in err_msg
                    or "quota" in err_msg_lower
                    or "resource_exhausted" in err_msg_lower
                    or "resourceexhausted" in err_msg_lower
                    or "limit" in err_msg_lower
                )
                is_hard_quota_error = (
                    "exceeded your current quota" in err_msg_lower
                    or "check your plan and billing" in err_msg_lower
                )
                if is_hard_quota_error:
                    raise e
                if is_rate_limit and attempt < max_retries - 1:
                    sleep_time = delay + random.uniform(0.1, 1.0)
                    logger.warning(
                        "Rate limit/quota reached (429). Retrying in %.2f seconds (attempt %d/%d)... Details: %s",
                        sleep_time, attempt + 1, max_retries, err_msg
                    )
                    time.sleep(sleep_time)
                    delay *= 2.0
                else:
                    raise e

    def _quota_error_message(self, error: Exception) -> str:
        return (
            "Gemini quota/rate limit was exhausted. The app now sends smaller embedding "
            "sub-batches, but this project may still need time for quota reset or a higher "
            "billing tier. Check active limits at https://ai.dev/rate-limit. "
            f"Original error: {error}"
        )

    def _is_quota_error(self, error: Exception) -> bool:
        err_msg = str(error).lower()
        return (
            "429" in err_msg
            or "quota" in err_msg
            or "resource_exhausted" in err_msg
            or "resourceexhausted" in err_msg
            or "rate limit" in err_msg
        )

    def generate_embedding(self, text: str, model: str = "models/gemini-embedding-001") -> List[float]:
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
            response = self._call_with_retry(
                self._client.embed_content,
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
            if self._is_quota_error(e):
                raise RuntimeError(self._quota_error_message(e)) from e
            raise RuntimeError(f"Failed to generate embedding: {e}") from e

    def generate_embeddings_batch(
        self,
        texts: List[str],
        model: str = "models/gemini-embedding-001",
        batch_size: Optional[int] = None,
        max_batch_chars: Optional[int] = None
    ) -> List[List[float]]:
        """
        Convert multiple texts into high-dimensional vector embeddings in batch.

        Internally splits the input list into sub-batches constrained by both
        item count and total character count. Results are concatenated in the
        original input order so the public interface is unchanged.

        Args:
            texts: List of code snippets or paragraphs to embed.
            model: Embedding model name.
            batch_size: Maximum number of texts sent in a single API call.
                        Defaults to settings.GEMINI_EMBEDDING_BATCH_SIZE.
            max_batch_chars: Maximum total characters sent in a single API call.
                             Defaults to settings.GEMINI_EMBEDDING_MAX_BATCH_CHARS.

        Returns:
            List of lists of float values representing the embedding vectors,
            in the same order as the input ``texts``.

        Raises:
            ValueError: If the texts list is empty, batch_size/max_batch_chars
                        are invalid, or any text element is empty.
            RuntimeError: If any API call fails after all retries.
        """
        if not texts:
            logger.error("Texts batch list cannot be empty.")
            raise ValueError("Texts batch list cannot be empty.")

        effective_batch_size = (
            settings.GEMINI_EMBEDDING_BATCH_SIZE if batch_size is None else batch_size
        )
        if effective_batch_size < 1:
            raise ValueError("batch_size must be a positive integer.")

        effective_max_batch_chars = (
            settings.GEMINI_EMBEDDING_MAX_BATCH_CHARS
            if max_batch_chars is None
            else max_batch_chars
        )
        if effective_max_batch_chars < 1:
            raise ValueError("max_batch_chars must be a positive integer.")

        inter_batch_delay = max(0.0, settings.GEMINI_EMBEDDING_BATCH_DELAY_SECONDS)

        for idx, text in enumerate(texts):
            if not text or not text.strip():
                logger.error("Text at batch index %d is empty.", idx)
                raise ValueError(f"Text at batch index {idx} cannot be empty.")

        sub_batches = self._build_embedding_sub_batches(
            texts,
            effective_batch_size,
            effective_max_batch_chars
        )
        total = len(texts)
        num_batches = len(sub_batches)
        logger.info(
            "generate_embeddings_batch: %d chunks, batch_size=%d, num_batches=%d, "
            "max_batch_chars=%d, inter_batch_delay=%.2fs, model=%s",
            total,
            effective_batch_size,
            num_batches,
            effective_max_batch_chars,
            inter_batch_delay,
            model
        )

        all_embeddings: List[List[float]] = []

        try:
            for batch_idx, batch_texts in enumerate(sub_batches):
                total_chars = sum(len(t) for t in batch_texts)

                logger.info(
                    "Embedding sub-batch %d/%d: items=%d, total_chars=%d",
                    batch_idx + 1, num_batches, len(batch_texts), total_chars
                )

                response = self._call_with_retry(
                    self._client.embed_content,
                    model=model,
                    content=batch_texts,
                    task_type="retrieval_document"
                )

                if "embedding" not in response:
                    logger.error(
                        "API response for sub-batch %d/%d did not contain 'embedding' key: %s",
                        batch_idx + 1, num_batches, response
                    )
                    raise RuntimeError("Invalid API response format: 'embedding' key not found.")

                batch_embeddings = response["embedding"]
                if not isinstance(batch_embeddings, list) or (
                    batch_embeddings and not isinstance(batch_embeddings[0], list)
                ):
                    logger.error(
                        "Sub-batch %d/%d returned embeddings in unexpected format: %s",
                        batch_idx + 1, num_batches, type(batch_embeddings)
                    )
                    raise RuntimeError(
                        "Returned embeddings from API did not match expected list-of-lists format."
                    )

                all_embeddings.extend(batch_embeddings)

                # Brief pause between sub-batches to avoid burst-rate 429s
                if batch_idx < num_batches - 1 and inter_batch_delay > 0:
                    time.sleep(inter_batch_delay)

            logger.info(
                "generate_embeddings_batch: completed. Total embeddings returned: %d",
                len(all_embeddings)
            )
            return all_embeddings

        except Exception as e:
            logger.exception("Failed to generate batch embeddings due to API error")
            if self._is_quota_error(e):
                raise RuntimeError(self._quota_error_message(e)) from e
            raise RuntimeError(f"Failed to generate batch embeddings: {e}") from e

    def _build_embedding_sub_batches(
        self,
        texts: List[str],
        batch_size: int,
        max_batch_chars: int
    ) -> List[List[str]]:
        sub_batches: List[List[str]] = []
        current_batch: List[str] = []
        current_chars = 0

        for text in texts:
            text_chars = len(text)
            would_exceed_items = len(current_batch) >= batch_size
            would_exceed_chars = (
                current_batch and current_chars + text_chars > max_batch_chars
            )

            if would_exceed_items or would_exceed_chars:
                sub_batches.append(current_batch)
                current_batch = []
                current_chars = 0

            current_batch.append(text)
            current_chars += text_chars

        if current_batch:
            sub_batches.append(current_batch)

        return sub_batches

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
            response = self._call_with_retry(generative_model.generate_content, prompt)
            return response.text
        except Exception as e:
            logger.exception("Failed to generate content: %s", e)
            raise RuntimeError(f"Failed to generate content: {e}") from e
