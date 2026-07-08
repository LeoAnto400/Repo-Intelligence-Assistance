// ─── Types ───────────────────────────────────────────────────────────────────

export type IngestResponse = {
  status: string
  repository: string
  files_processed: number
  chunks_created: number
  repo_url?: string
}

export type QueryResponse = {
  answer: string
  source_files: string[]
  retrieved_chunks: number
}

// ─── Ingest ──────────────────────────────────────────────────────────────────

/**
 * Ingests a GitHub repository into the RAG pipeline.
 * The backend processes synchronously and returns a single JSON response.
 * Throws an Error with a user-readable message on failure.
 */
export async function ingestRepository(
  repoUrl: string,
  signal?: AbortSignal,
): Promise<IngestResponse> {
  const res = await fetch('/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_url: repoUrl }),
    signal,
  })

  if (!res.ok) {
    const detail = await readErrorDetail(res)
    throw new Error(detail || `Ingest failed (HTTP ${res.status})`)
  }

  return res.json() as Promise<IngestResponse>
}

// ─── Query ───────────────────────────────────────────────────────────────────

/**
 * Sends a question to the active ingested repository and returns the AI answer.
 * Throws an Error with a user-readable message on failure.
 */
export async function sendMessage(question: string): Promise<QueryResponse> {
  const res = await fetch('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  })

  if (!res.ok) {
    const detail = await readErrorDetail(res)
    throw new Error(detail || `Query failed (HTTP ${res.status})`)
  }

  return res.json() as Promise<QueryResponse>
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function readErrorDetail(res: Response): Promise<string> {
  try {
    const data = await res.json()
    return data.detail || data.message || ''
  } catch {
    return res.text().catch(() => '')
  }
}
