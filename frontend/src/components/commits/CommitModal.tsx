import type { Commit } from '../../services/mockCommits'

export function CommitModal({ commit, onClose }: { commit: Commit | null; onClose: () => void }) {
  if (!commit) return null

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative z-50 w-full max-w-2xl rounded-xl bg-white p-6 shadow-lg dark:bg-slate-900">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-lg font-semibold">Commit {commit.hash}</h3>
            <p className="text-sm text-slate-500">{commit.author} • {new Date(commit.time).toLocaleString()}</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-700">Close</button>
        </div>

        <div className="mt-4 space-y-3">
          <div>
            <h4 className="text-sm font-medium">Message</h4>
            <p className="text-sm text-slate-700 dark:text-slate-200">{commit.message}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium">Branch</h4>
            <p className="text-sm text-slate-700 dark:text-slate-200">{commit.branch}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium">Changes</h4>
            <p className="text-sm text-slate-700 dark:text-slate-200">{commit.filesChanged} files changed • +{commit.additions} −{commit.deletions}</p>
          </div>

          <div>
            <h4 className="text-sm font-medium">Diff (snippet)</h4>
            <pre className="mt-2 max-h-48 overflow-auto rounded-md bg-slate-100 p-3 text-xs dark:bg-slate-800">{commit.diff}</pre>
          </div>
        </div>
      </div>
    </div>
  )
}

export default CommitModal
