import { useEffect, useRef, useState } from 'react'
import type { ChatMessage } from '../../services/mockChat'
import { sendMessageMock } from '../../services/mockChat'
import MessageItem from './MessageItem'
import ChatInput from './ChatInput'

export function ChatWindow() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loading, setLoading] = useState(false)
  const [typing, setTyping] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    // load saved history or fall back to welcome
    try {
      const raw = localStorage.getItem('repo_chat_history')
      if (raw) {
        const parsed = JSON.parse(raw) as ChatMessage[]
        setMessages(parsed)
        return
      }
    } catch (e) {
      // ignore
    }

    setMessages([
      { id: 'sys-1', role: 'assistant', content: 'Hello! I am your repository assistant. Ask me anything.', created_at: new Date().toISOString() },
    ])
  }, [])

  useEffect(() => {
    // auto-scroll to bottom when messages change
    const c = containerRef.current
    if (!c) return
    c.scrollTo({ top: c.scrollHeight, behavior: 'smooth' })
  }, [messages, typing])

  async function handleSend(text: string) {
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text, created_at: new Date().toISOString() }
    setMessages((m) => {
      const next = [...m, userMsg]
      try { localStorage.setItem('repo_chat_history', JSON.stringify(next)) } catch {}
      return next
    })
    setLoading(true)
    setTyping(true)

    // simulate assistant typing then respond
    const resp = await sendMessageMock(text)
    setTyping(false)
    setMessages((m) => {
      const next = [...m, resp]
      try { localStorage.setItem('repo_chat_history', JSON.stringify(next)) } catch {}
      return next
    })
    setLoading(false)
  }

  useEffect(() => {
    // ensure messages persist on changes as well
    try { localStorage.setItem('repo_chat_history', JSON.stringify(messages)) } catch {}
  }, [messages])

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
            <div className="text-sm text-slate-500">Assistant is typing<span className="animate-pulse">…</span></div>
          </div>
        )}
      </div>

      <ChatInput onSend={handleSend} loading={loading} />
    </div>
  )
}

export default ChatWindow
