export type IngestProgress = {
  stage?: string
  detail?: string
}

export async function ingestRepository(
  repoUrl: string,
  onProgress?: (p: IngestProgress) => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch('/ingest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ repo_url: repoUrl }),
    signal,
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(text || `Ingest failed with status ${res.status}`)
  }

  // If the server returns a streaming body (SSE / text lines / NDJSON), consume it.
  if (!res.body) return

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    let lines = buffer.split(/\r?\n/)
    buffer = lines.pop() || ''

    for (const raw of lines) {
      if (!raw) continue
      let text = raw.trim()
      // support "data: {...}" style chunks
      if (text.startsWith('data:')) text = text.replace(/^data:\s*/i, '')

      try {
        const obj = JSON.parse(text)
        onProgress?.({ stage: obj.stage, detail: obj.detail || obj.message })
      } catch (e) {
        // fallback to plain text messages
        onProgress?.({ stage: text })
      }
    }
  }

  // process any remaining buffer
  if (buffer) {
    const text = buffer.trim()
    if (text) {
      try {
        const obj = JSON.parse(text)
        onProgress?.({ stage: obj.stage, detail: obj.detail || obj.message })
      } catch (e) {
        onProgress?.({ stage: text })
      }
    }
  }
}
