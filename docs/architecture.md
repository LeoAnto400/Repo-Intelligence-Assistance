Goal:
Build a Multi-Agent GitHub Repository Intelligence Assistant.

Core Use Cases:

1. Explain repository architecture
2. Explain specific code functionality
3. Locate implementations
4. Trace dependencies
5. Generate documentation

System Components:

- Repository Ingestion
- Chunking
- Embeddings
- Vector Database
- Retrieval Agent
- Analysis Agent
- Orchestrator
- API Layer

Tech Stack:
Backend : FastAPI
VectorDB : ChromaDB
Embeddings : Gemini Embeddings
LLM : Gemini 2.5 Flash
Agent Framework: LangGraph



MVP
User provides GitHub URL
↓
Repository indexed
↓
User asks:
"How does authentication work?"
↓
System answers

Initial Architecture
User
 ↓
Orchestrator
 ↓
Retrieval Agent
 ↓
Analysis Agent
 ↓
Response

Retrieval Agent
Input: Question
Output: Relevant code chunks

Analysis Agent
Input: Question + Retrieved chunks
Output: Explanation

Orchestrator
Input: Question
Output: Final answer
Responsibilities:
Call Retrieval
↓
Call Analysis
↓
Return result