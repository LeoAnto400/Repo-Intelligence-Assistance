import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ChatMessage } from '../../services/mockChat'

declare const marked: any
declare const hljs: any

const FILE_LINK_REGEX = /(?<file>(?:[\w\-./]+\/)?[\w\-]+\.(?:java|ts|tsx|js|json|md|py|cs))(?:\s*(?:line|lines)\s*(?<start>\d+)(?:-(?<end>\d+))?)?/gi

export function MessageItem({ msg }: { msg: ChatMessage }) {
  const ref = useRef<HTMLDivElement | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!ref.current) return

    let content = msg.content || ''
    content = content.replace(FILE_LINK_REGEX, (match, file, _, start, end) => {
      const fileParam = encodeURIComponent(file)
      const params = []
      if (start) {
        params.push(`line=${encodeURIComponent(start)}`)
        if (end) params.push(`end=${encodeURIComponent(end)}`)
      }
      const href = `/repository?file=${fileParam}${params.length ? `&${params.join('&')}` : ''}`
      return `<a href=\"${href}\" class=\"ai-file-link text-sky-600 hover:underline dark:text-sky-400\">${match}</a>`
    })

    try {
      ref.current.innerHTML = marked.parse(content)
    } catch (e) {
      ref.current.textContent = content
    }

    try {
      ref.current.querySelectorAll('pre code').forEach((block: any) => {
        try { hljs.highlightElement(block) } catch (e) { /* ignore */ }

        const pre = block.parentElement as HTMLElement
        if (!pre) return
        if (pre.querySelector('.copy-btn')) return
        const btn = document.createElement('button')
        btn.className = 'copy-btn absolute right-2 top-2 rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800'
        btn.textContent = 'Copy'
        btn.onclick = async () => {
          try {
            await navigator.clipboard.writeText(block.textContent || '')
            btn.textContent = 'Copied'
            setTimeout(() => (btn.textContent = 'Copy'), 1200)
          } catch {
            btn.textContent = 'Error'
          }
        }
        pre.style.position = 'relative'
        pre.appendChild(btn)
      })
    } catch (e) {
      /* ignore */
    }

    ref.current.querySelectorAll('a.ai-file-link').forEach((anchor) => {
      anchor.addEventListener('click', (event) => {
        event.preventDefault()
        const href = (event.currentTarget as HTMLAnchorElement).getAttribute('href')
        if (href) navigate(href)
      })
    })
  }, [msg, navigate])

  const isUser = msg.role === 'user'

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} py-2`}> 
      <div className={`${isUser ? 'order-2 ml-3' : 'order-1 mr-3'} max-w-[78%]`}> 
        <div className={`rounded-xl p-3 text-sm ${isUser ? 'bg-sky-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100'}`}>
          <div ref={ref} />
        </div>
        <div className={`mt-1 text-xs ${isUser ? 'text-right text-slate-400' : 'text-left text-slate-500 dark:text-slate-400'}`}>
          <span>{new Date(msg.created_at).toLocaleTimeString()}</span>
        </div>
        {!isUser && (msg.sources?.length || msg.chunk_count) ? (
          <div className="mt-2 rounded-md border border-slate-100 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="mb-2 text-slate-600 dark:text-slate-300">Sources ({msg.sources?.length ?? 0}) • Retrieved chunks: {msg.chunk_count ?? 0}</div>
            <ul className="space-y-1">
              {msg.sources?.map((s, idx) => (
                <li key={idx} className="truncate text-ellipsis text-slate-700 dark:text-slate-200">{s.path}{s.snippet ? ` — ${s.snippet.slice(0, 120)}...` : ''}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default MessageItem
