import unittest
from unittest.mock import AsyncMock, MagicMock

from src.agents.analysis import AnalysisAgent
from src.agents.orchestrator import AgentState, Orchestrator, OrchestratorResult
from src.agents.retrieval import RetrievalAgent


class TestOrchestratorResult(unittest.TestCase):
    def test_orchestrator_result_fields(self):
        result = OrchestratorResult(
            answer="Use the auth middleware.",
            source_files=["src/auth.py"],
            retrieved_chunks=2,
        )

        self.assertEqual(result.answer, "Use the auth middleware.")
        self.assertEqual(result.source_files, ["src/auth.py"])
        self.assertEqual(result.retrieved_chunks, 2)


class TestOrchestrator(unittest.IsolatedAsyncioTestCase):
    def setUp(self):
        self.retrieval_agent = MagicMock(spec=RetrievalAgent)
        self.analysis_agent = MagicMock(spec=AnalysisAgent)
        self.retrieval_agent.process = AsyncMock()
        self.analysis_agent.process = AsyncMock()
        self.orchestrator = Orchestrator(
            retrieval_agent=self.retrieval_agent,
            analysis_agent=self.analysis_agent,
        )

    async def test_process_coordinates_retrieval_and_analysis(self):
        retrieval_results = [
            {
                "chunk_id": "chunk-1",
                "file_path": "src/auth.py",
                "content": "def login(): pass",
                "score": 0.1,
                "metadata": {"chunk_type": "function"},
            },
            {
                "chunk_id": "chunk-2",
                "file_path": "src/routes.py",
                "content": "router.post('/login')",
                "score": 0.2,
                "metadata": {"chunk_type": "file"},
            },
        ]
        self.retrieval_agent.process.return_value = {
            "results": retrieval_results,
            "error": None,
        }
        self.analysis_agent.process.return_value = {
            "answer": "Authentication is handled by login routes.",
            "source_files": ["src/auth.py", "src/routes.py"],
            "chunk_count": 2,
            "error": None,
        }

        result = await self.orchestrator.process(" How does auth work? ")

        self.assertEqual(
            result,
            OrchestratorResult(
                answer="Authentication is handled by login routes.",
                source_files=["src/auth.py", "src/routes.py"],
                retrieved_chunks=2,
            ),
        )
        self.retrieval_agent.process.assert_awaited_once_with({
            "query": "How does auth work?"
        })
        self.analysis_agent.process.assert_awaited_once_with({
            "question": "How does auth work?",
            "retrieval_results": retrieval_results,
        })
        self.assertEqual(self.orchestrator.last_state["question"], "How does auth work?")
        self.assertEqual(self.orchestrator.last_state["retrieval_results"], retrieval_results)
        self.assertEqual(self.orchestrator.last_state["analysis_result"]["answer"], result.answer)
        self.assertIsNone(self.orchestrator.last_state["error"])

    async def test_process_rejects_empty_question(self):
        with self.assertRaises(ValueError) as context:
            await self.orchestrator.process("   ")

        self.assertIn("Question cannot be empty", str(context.exception))
        self.assertEqual(self.orchestrator.last_state["error"], "Question cannot be empty.")
        self.retrieval_agent.process.assert_not_awaited()
        self.analysis_agent.process.assert_not_awaited()

    async def test_process_raises_when_retrieval_returns_error(self):
        self.retrieval_agent.process.return_value = {
            "results": [],
            "error": "Required field 'repository_id' is missing or empty.",
        }

        with self.assertLogs("src.agents.orchestrator", level="ERROR") as logs:
            with self.assertRaises(RuntimeError) as context:
                await self.orchestrator.process("Where is login?")

        self.assertIn("Retrieval failed", str(context.exception))
        self.assertIn("repository_id", self.orchestrator.last_state["error"])
        self.assertIn("Retrieval failed during orchestration", "\n".join(logs.output))
        self.analysis_agent.process.assert_not_awaited()

    async def test_process_raises_when_retrieval_results_are_invalid(self):
        self.retrieval_agent.process.return_value = {
            "results": "not-a-list",
            "error": None,
        }

        with self.assertRaises(RuntimeError) as context:
            await self.orchestrator.process("Where is login?")

        self.assertIn("expected a list", str(context.exception))
        self.assertIn("expected a list", self.orchestrator.last_state["error"])
        self.analysis_agent.process.assert_not_awaited()

    async def test_process_raises_when_retrieval_agent_throws(self):
        self.retrieval_agent.process.side_effect = Exception("vector store offline")

        with self.assertRaises(RuntimeError) as context:
            await self.orchestrator.process("Where is login?")

        self.assertIn("Retrieval agent failed", str(context.exception))
        self.assertIn("vector store offline", self.orchestrator.last_state["error"])
        self.analysis_agent.process.assert_not_awaited()

    async def test_process_raises_when_analysis_returns_error(self):
        retrieval_results = [{"chunk_id": "chunk-1", "content": "code"}]
        self.retrieval_agent.process.return_value = {
            "results": retrieval_results,
            "error": None,
        }
        self.analysis_agent.process.return_value = {
            "answer": "",
            "source_files": [],
            "chunk_count": 0,
            "error": "LLM unavailable",
        }

        with self.assertLogs("src.agents.orchestrator", level="ERROR") as logs:
            with self.assertRaises(RuntimeError) as context:
                await self.orchestrator.process("Explain it")

        self.assertIn("Analysis failed", str(context.exception))
        self.assertIn("LLM unavailable", self.orchestrator.last_state["error"])
        self.assertEqual(self.orchestrator.last_state["retrieval_results"], retrieval_results)
        self.assertIn("Analysis failed during orchestration", "\n".join(logs.output))

    async def test_process_raises_when_analysis_agent_throws(self):
        self.retrieval_agent.process.return_value = {
            "results": [],
            "error": None,
        }
        self.analysis_agent.process.side_effect = Exception("Gemini down")

        with self.assertRaises(RuntimeError) as context:
            await self.orchestrator.process("Explain it")

        self.assertIn("Analysis agent failed", str(context.exception))
        self.assertIn("Gemini down", self.orchestrator.last_state["error"])

    def test_agent_state_typing_exports_expected_keys(self):
        state: AgentState = {
            "question": "What does this do?",
            "retrieval_results": [],
            "analysis_result": None,
            "error": None,
        }

        self.assertEqual(state["question"], "What does this do?")


if __name__ == "__main__":
    unittest.main()
