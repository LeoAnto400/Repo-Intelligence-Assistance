import type { PullRequest } from '../../services/mockPRs'

export function PullItem({ pr, onClick }: { pr: PullRequest; onClick: (p: PullRequest) => void }) {
  return (
    <div className="flex items-start justify-between border-b border-slate-100 py-3 last:border-b-0 dark:border-slate-800">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-sm font-medium dark:bg-slate-800">{pr.author[0]}</div>
        <div>
          <button onClick={() => onClick(pr)} className="text-sm font-medium text-slate-900 hover:underline dark:text-slate-100">#{pr.number} {pr.title}</button>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="mr-2">{pr.author}</span>
            <span className="mr-2">•</span>
            <span>{new Date(pr.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <div className="text-sm text-slate-500 dark:text-slate-400">{pr.status}</div>
      </div>
    </div>
  )
}

export default PullItem
