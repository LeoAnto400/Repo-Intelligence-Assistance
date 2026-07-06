import ChatWindow from '../components/chat/ChatWindow'

export function ChatPage() {
  return (
    <div className="rounded-3xl border border-slate-200/70 bg-white/80 p-4 shadow-sm shadow-slate-200/60 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <ChatWindow />
    </div>
  )
}
