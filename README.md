# GitHub Repository Intelligence Assistant

A multi-agent codebase intelligence assistant built with FastAPI, ChromaDB, Gemini, and LangGraph.

## Architecture

The project consists of three specialized agents that coordinate to answer user questions about codebases:

1. **RetrievalAgent**: Queries the local Chroma vector database to extract the most relevant code chunks for a given question.
2. **AnalysisAgent**: Utilizes Gemini LLM to analyze the retrieved code snippets and synthesize detailed explanations.
3. **Orchestrator**: Routes user queries, coordinates state, and executes flow transitions between the agents.

## Project Structure

```
src/
├── agents/          # Multi-agent implementations (base interfaces, retrieval, analysis, orchestrator)
├── api/             # FastAPI application, route handlers, and Pydantic schemas
├── core/            # Configuration management (Pydantic Settings)
├── db/              # Vector database interface (ChromaDB wrapper)
└── services/        # Integration services (Gemini API, GitHub file ingestion)
```

## Setup & Running

1. **Environment Variables**:
   Copy `.env.example` to `.env` and fill in your details:
   ```bash
   cp .env.example .env
   ```

2. **Installation**:
   ```bash
   pip install -r requirements.txt
   ```

3. **Running the Application**:
   ```bash
   python main.py
   ```
   Or run directly with uvicorn:
   ```bash
   uvicorn src.api.main:app --reload
   ```

   Current Status

✅ Project structure
⬜ Repository ingestion
⬜ Chunking
⬜ Embeddings
⬜ ChromaDB
⬜ Retrieval
⬜ Analysis Agent
⬜ LangGraph
