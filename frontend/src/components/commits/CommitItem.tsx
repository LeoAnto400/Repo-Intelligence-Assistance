import type { Commit } from '../../services/mockCommits'

export function CommitItem({ commit, onClick }: { commit: Commit; onClick: (c: Commit) => void }) {
  return (
    <div className="flex items-start justify-between border-b border-slate-100 py-3 last:border-b-0 dark:border-slate-800">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-100 text-sm font-medium dark:bg-slate-800">{commit.author[0]}</div>
        <div>
          <button onClick={() => onClick(commit)} className="text-sm font-medium text-slate-900 hover:underline dark:text-slate-100">{commit.message}</button>
          <div className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            <span className="font-mono mr-2">{commit.hash.slice(0, 7)}</span>
            <span>{commit.author}</span>
            <span className="mx-2">•</span>
            <span>{new Date(commit.time).toLocaleString()}</span>
          </div>
        </div>
      </div>
      <div className="text-sm text-slate-500 dark:text-slate-400">{commit.branch}</div>
    </div>
  )
}

export default CommitItem
