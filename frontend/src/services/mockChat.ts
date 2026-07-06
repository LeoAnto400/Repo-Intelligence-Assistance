export type Role = 'user' | 'assistant'

export type ChatMessage = {
  id: string
  role: Role
  content: string
  created_at: string
  sources?: { path: string; snippet?: string }[]
  chunk_count?: number
}

function id() {
  return Math.random().toString(36).slice(2, 9)
}

const BOT_RESPONSES = [
  'Sure — I can help with that. Can you share more details?',
  'I looked through the repository and prepared a summary of the key modules.',
  'Here is a code example that demonstrates the approach:\n\n```ts\nfunction greet(name: string) {\n  return `Hello, ${name}!`\n}\n```\n\nLet me know if you want a runnable snippet.',
  'I simulated running the analysis; everything looks green. Would you like to open the report?',
]

export async function sendMessageMock(userMessage: string): Promise<ChatMessage> {
  // Try to call backend POST /query first
  try {
    const res = await fetch('/query', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question: userMessage }),
    })

    if (res.ok) {
      const data = await res.json().catch(() => ({}))
      // tolerant parsing of fields
      const content = data.answer || data.message || data.text || data.response || ''
      const sources = data.sources || data.source_files || data.files || []
      const chunk_count = data.retrieved_chunks || data.retrieved_count || data.chunk_count || data.count || 0

      return {
        id: id(),
        role: 'assistant',
        content: content || BOT_RESPONSES[Math.floor(Math.random() * BOT_RESPONSES.length)],
        created_at: new Date().toISOString(),
        sources: Array.isArray(sources) ? sources.map((s: any) => (typeof s === 'string' ? { path: s } : s)) : [],
        chunk_count: Number(chunk_count) || 0,
      }
    }
  } catch (e) {
    // ignore and fallback to mock
  }

  // Fallback mock response
  await new Promise((r) => setTimeout(r, 400))
  const text = BOT_RESPONSES[Math.floor(Math.random() * BOT_RESPONSES.length)]
  return {
    id: id(),
    role: 'assistant',
    content: text,
    created_at: new Date().toISOString(),
    sources: [],
    chunk_count: 0,
  }
}
