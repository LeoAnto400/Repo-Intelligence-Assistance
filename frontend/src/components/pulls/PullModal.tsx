import type { PullRequest } from '../../services/mockPRs'

export function PullModal({ pr, onClose }: { pr: PullRequest | null; onClose: () => void }) {
  if (!pr) return null
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl rounded-xl bg-white p-6 shadow-lg dark:bg-slate-900">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">PR #{pr.number} — {pr.title}</h3>
            <p className="text-sm text-slate-500">{pr.author} • {new Date(pr.created_at).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">Close</button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <h4 className="text-sm font-medium">Status</h4>
            <p className="text-sm text-slate-700 dark:text-slate-200">{pr.status}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium">Labels</h4>
            <div className="mt-2 flex flex-wrap gap-2">
              {pr.labels.length === 0 ? <span className="text-sm text-slate-500">—</span> : pr.labels.map((l) => <span key={l} className="rounded-full bg-slate-100 px-2 py-1 text-xs dark:bg-slate-800">{l}</span>)}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium">Reviewers</h4>
            <p className="text-sm text-slate-700 dark:text-slate-200">{pr.reviewers?.join(', ')}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium">Body</h4>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-200">{pr.body}</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default PullModal
