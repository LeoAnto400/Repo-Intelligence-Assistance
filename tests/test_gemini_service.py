import os
import unittest
from unittest.mock import patch, MagicMock
from src.services.gemini import GeminiService

class TestGeminiService(unittest.TestCase):
    
    @patch("google.generativeai.configure")
    def test_init_success_direct_key(self, mock_configure):
        service = GeminiService(api_key="direct-key-123")
        self.assertEqual(service.api_key, "direct-key-123")
        mock_configure.assert_called_once_with(api_key="direct-key-123")

    @patch("os.environ", {"GEMINI_API_KEY": "env-key-456"})
    @patch("google.generativeai.configure")
    def test_init_success_env_key(self, mock_configure):
        service = GeminiService()
        self.assertEqual(service.api_key, "env-key-456")
        mock_configure.assert_called_once_with(api_key="env-key-456")

    @patch("os.environ", {})
    @patch("src.core.config.settings")
    def test_init_missing_key_error(self, mock_settings):
        mock_settings.GEMINI_API_KEY = ""
        with self.assertRaises(ValueError) as context:
            GeminiService()
        self.assertIn("Gemini API key is required", str(context.exception))

    @patch("google.generativeai.configure")
    def test_generate_embedding_success(self, mock_configure):
        service = GeminiService(api_key="key")
        
        dummy_embedding = [0.1, 0.2, 0.3]
        service._client.embed_content = MagicMock(return_value={"embedding": dummy_embedding})
        
        result = service.generate_embedding("hello world", model="models/text-embedding-004")
        
        service._client.embed_content.assert_called_once_with(
            model="models/text-embedding-004",
            content="hello world",
            task_type="retrieval_document"
        )
        self.assertEqual(result, dummy_embedding)

    @patch("google.generativeai.configure")
    def test_generate_embedding_empty_text_error(self, mock_configure):
        service = GeminiService(api_key="key")
        with self.assertRaises(ValueError):
            service.generate_embedding("")
        with self.assertRaises(ValueError):
            service.generate_embedding("   ")

    @patch("google.generativeai.configure")
    def test_generate_embedding_api_error(self, mock_configure):
        service = GeminiService(api_key="key")
        service._client.embed_content = MagicMock(side_effect=Exception("API failure"))
        
        with self.assertRaises(RuntimeError) as context:
            service.generate_embedding("hello")
        self.assertIn("Failed to generate embedding", str(context.exception))

    @patch("google.generativeai.configure")
    def test_generate_embeddings_batch_success(self, mock_configure):
        service = GeminiService(api_key="key")
        
        dummy_embeddings = [[0.1, 0.2], [0.3, 0.4]]
        service._client.embed_content = MagicMock(return_value={"embedding": dummy_embeddings})
        
        result = service.generate_embeddings_batch(["hello", "world"])
        
        service._client.embed_content.assert_called_once_with(
            model="models/text-embedding-004",
            content=["hello", "world"],
            task_type="retrieval_document"
        )
        self.assertEqual(result, dummy_embeddings)

    @patch("google.generativeai.configure")
    def test_generate_embeddings_batch_validation_error(self, mock_configure):
        service = GeminiService(api_key="key")
        # Empty list
        with self.assertRaises(ValueError):
            service.generate_embeddings_batch([])
        # Empty element in list
        with self.assertRaises(ValueError):
            service.generate_embeddings_batch(["hello", ""])

    @patch("google.generativeai.configure")
    def test_generate_content_success(self, mock_configure):
        service = GeminiService(api_key="key")
        
        mock_model = MagicMock()
        mock_response = MagicMock()
        mock_response.text = "generated response text"
        mock_model.generate_content.return_value = mock_response
        
        service._client.GenerativeModel = MagicMock(return_value=mock_model)
        
        result = service.generate_content("tell me a story", system_instruction="be brief")
        
        service._client.GenerativeModel.assert_called_once_with(
            model_name="gemini-2.5-flash",
            system_instruction="be brief"
        )
        mock_model.generate_content.assert_called_once_with("tell me a story")
        self.assertEqual(result, "generated response text")

    @patch("google.generativeai.configure")
    def test_generate_content_validation_error(self, mock_configure):
        service = GeminiService(api_key="key")
        with self.assertRaises(ValueError):
            service.generate_content("")

if __name__ == "__main__":
    unittest.main()
