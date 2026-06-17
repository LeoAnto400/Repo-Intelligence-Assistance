import unittest
from unittest.mock import AsyncMock, MagicMock

from fastapi.testclient import TestClient

import src.api.routes as routes
from src.agents.orchestrator import OrchestratorResult
from src.api.main import app
from src.services.chunker import Chunk


class TestApi(unittest.TestCase):
    def setUp(self):
        app.dependency_overrides.clear()
        routes.get_github_service.cache_clear()
        routes.get_chunker.cache_clear()
        routes.get_gemini_service.cache_clear()
        routes.get_vector_store.cache_clear()
        routes.get_retrieval_agent.cache_clear()
        routes.get_analysis_agent.cache_clear()
        routes.get_orchestrator.cache_clear()
        routes._active_repository = None
        self.client = TestClient(app)

    def tearDown(self):
        app.dependency_overrides.clear()
        routes._active_repository = None

    def test_health_endpoint(self):
        response = self.client.get("/health")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {"status": "healthy"})

    def test_ingest_endpoint_success(self):
        github_service = MagicMock()
        github_service.fetch_repo_files.return_value = [
            {
                "path": "src/auth.py",
                "content": "def login():\n    return True",
                "language": "Python",
            }
        ]
        chunk = Chunk(
            chunk_id="chunk-1",
            file_path="src/auth.py",
            content="def login():\n    return True",
            chunk_type="function",
            metadata={"start_line": 1, "end_line": 2},
        )
        chunker = MagicMock()
        chunker.chunk_file.return_value = [chunk]
        gemini_service = MagicMock()
        gemini_service.generate_embeddings_batch.return_value = [[0.1, 0.2, 0.3]]
        vector_store = MagicMock()

        app.dependency_overrides[routes.get_github_service] = lambda: github_service
        app.dependency_overrides[routes.get_chunker] = lambda: chunker
        app.dependency_overrides[routes.get_gemini_service] = lambda: gemini_service
        app.dependency_overrides[routes.get_vector_store] = lambda: vector_store

        response = self.client.post(
            "/api/v1/ingest",
            json={"repo_url": "https://github.com/example/demo"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "status": "success",
            "repository": "demo",
            "files_processed": 1,
            "chunks_created": 1,
        })
        github_service.fetch_repo_files.assert_called_once_with("https://github.com/example/demo")
        gemini_service.generate_embeddings_batch.assert_called_once_with([
            "def login():\n    return True"
        ])
        vector_store.reset_collection.assert_called_once_with("demo")
        vector_store.add_documents.assert_called_once()
        self.assertEqual(routes.get_active_repository(), "demo")

    def test_ingest_endpoint_rejects_invalid_url(self):
        response = self.client.post(
            "/api/v1/ingest",
            json={"repo_url": "not-a-url"},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Invalid repository URL", response.json()["detail"])

    def test_ingest_endpoint_reports_embedding_failure(self):
        github_service = MagicMock()
        github_service.fetch_repo_files.return_value = [
            {
                "path": "src/auth.py",
                "content": "def login(): pass",
                "language": "Python",
            }
        ]
        chunker = MagicMock()
        chunker.chunk_file.return_value = [
            Chunk(
                chunk_id="chunk-1",
                file_path="src/auth.py",
                content="def login(): pass",
                chunk_type="function",
            )
        ]
        gemini_service = MagicMock()
        gemini_service.generate_embeddings_batch.side_effect = RuntimeError("Gemini down")
        vector_store = MagicMock()

        app.dependency_overrides[routes.get_github_service] = lambda: github_service
        app.dependency_overrides[routes.get_chunker] = lambda: chunker
        app.dependency_overrides[routes.get_gemini_service] = lambda: gemini_service
        app.dependency_overrides[routes.get_vector_store] = lambda: vector_store

        response = self.client.post(
            "/api/v1/ingest",
            json={"repo_url": "https://github.com/example/demo"},
        )

        self.assertEqual(response.status_code, 502)
        self.assertIn("Embedding generation failed", response.json()["detail"])
        vector_store.add_documents.assert_not_called()

    def test_query_endpoint_success(self):
        orchestrator = MagicMock()
        orchestrator.process = AsyncMock(return_value=OrchestratorResult(
            answer="Authentication uses login handlers.",
            source_files=["src/auth.py"],
            retrieved_chunks=2,
        ))
        app.dependency_overrides[routes.get_orchestrator] = lambda: orchestrator

        response = self.client.post(
            "/api/v1/query",
            json={"question": "How does auth work?"},
        )

        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json(), {
            "answer": "Authentication uses login handlers.",
            "source_files": ["src/auth.py"],
            "retrieved_chunks": 2,
        })
        orchestrator.process.assert_awaited_once_with("How does auth work?")

    def test_query_endpoint_rejects_empty_question(self):
        response = self.client.post(
            "/api/v1/query",
            json={"question": "   "},
        )

        self.assertEqual(response.status_code, 400)
        self.assertIn("Question cannot be empty", response.json()["detail"])

    def test_query_endpoint_reports_orchestrator_failure(self):
        orchestrator = MagicMock()
        orchestrator.process = AsyncMock(side_effect=RuntimeError("Retrieval failed"))
        app.dependency_overrides[routes.get_orchestrator] = lambda: orchestrator

        response = self.client.post(
            "/api/v1/query",
            json={"question": "How does auth work?"},
        )

        self.assertEqual(response.status_code, 500)
        self.assertIn("Retrieval failed", response.json()["detail"])


if __name__ == "__main__":
    unittest.main()
