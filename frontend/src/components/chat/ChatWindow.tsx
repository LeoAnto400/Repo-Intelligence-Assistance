import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../services/mockChat'
import { sendMessage } from '../../services/api'
import MessageItem from './MessageItem'
import ChatInput from './ChatInput'

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [typing, setTyping] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // load saved history or fall back to welcome message
    try {
      const raw = localStorage.getItem('repo_chat_history')
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[]
        setMessages(parsed)
        return
      }
    } catch {
      // ignore parse errors
    }

    setMessages([
      {
        id: 'sys-1',
        role: 'assistant',
        content: 'Hello! I am your repository assistant. Ingest a repository on the Home page, then ask me anything about the code.',
        created_at: new Date().toISOString(),
      },
    ])
  }, [])

  useEffect(() => {
    // auto-scroll to bottom when messages change
    const c = containerRef.current
    if (!c) return
    c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' })
  }, [messages, typing])

  useEffect(() => {
    // persist messages to localStorage
    try {
      localStorage.setItem('repo_chat_history', JSON.stringify(messages))
    } catch {
      // ignore storage errors
    }
  }, [messages])

  async function handleSend(text: string) {
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: text,
      created_at: new Date().toISOString(),
    }
    setMessages((m) => [...m, userMsg])
    setLoading(true)
    setTyping(true)

    try {
      const data = await sendMessage(text)
      setTyping(false)

      const assistantMsg: ChatMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: data.answer || '(No answer returned)',
        created_at: new Date().toISOString(),
        sources: data.source_files.map((path) => ({ path })),
        chunk_count: data.retrieved_chunks,
      }
      setMessages((m) => [...m, assistantMsg])
    } catch (err: unknown) {
      setTyping(false)
      const message = err instanceof Error ? err.message : 'An unexpected error occurred.'
      const errorMsg: ChatMessage = {
        id: `err-${Date.now()}`,
        role: 'assistant',
        content: `⚠️ ${message}`,
        created_at: new Date().toISOString(),
      }
      setMessages((m) => [...m, errorMsg])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-[70vh] max-h-[80vh] w-full flex-col">
      <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-800">
        <h2 className="text-lg font-semibold">Repository Chat</h2>
      </div>

      <div ref={containerRef} className="flex-1 overflow-auto px-4 py-4">
        <div className="space-y-2">
          {messages.map((m) => <MessageItem key={m.id} msg={m} />)}
        </div>

        {typing && (
          <div className="mt-2 flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-slate-100 dark:bg-slate-800" />
            <div className="text-sm text-slate-500">
              Assistant is thinking<span className="animate-pulse">…</span>
            </div>
          </div>
        )}
      </div>

      <ChatInput onSend={handleSend} loading={loading} />
    </div>
  )
}

export default ChatWindow
