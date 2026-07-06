import { useState } from 'react'
import { Button } from '../ui/button'

export function ChatInput({ onSend, loading }: { onSend: (text: string) => void; loading?: boolean }) {
  const [value, setValue] = useState('')

  function submit() {
    const v = value.trim()
    if (!v) return
    onSend(v)
    setValue('')
  }

  return (
    <div className="w-full border-t border-slate-200 bg-white/60 p-3 dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex gap-2">
        <textarea
          value={value}
          onChange={(e) => setValue(e.target.value)}
          rows={2}
          placeholder="Send a message... (Shift+Enter for newline)"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              submit()
            }
          }}
          className="min-h-[48px] max-h-40 w-full resize-none rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none dark:border-slate-800 dark:bg-slate-900/40"
        />
        <div className="flex-shrink-0">
          <Button onClick={submit} disabled={loading}>{loading ? 'Sending…' : 'Send'}</Button>
        </div>
      </div>
    </div>
  )
}

export default ChatInput
