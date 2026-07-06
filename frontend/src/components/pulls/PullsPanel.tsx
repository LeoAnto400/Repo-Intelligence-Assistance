import { useEffect, useState } from 'react'
import { fetchPulls, type PullRequest } from '../../services/mockPRs'
import { PullItem } from './PullItem'
import { PullModal } from './PullModal'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

export function PullsPanel() {
  const [pulls, setPulls] = useState<PullRequest[]>([])
  const [page, setPage] = useState(1)
  const [perPage] = useState(8)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<PullRequest | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchPulls({ page, perPage, q, status }).then((res) => {
      if (!mounted) return
      setPulls(res.pulls)
      setTotal(res.total)
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [page, perPage, q, status])

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Pull Requests</h3>
        <div className="flex items-center gap-2">
          <select className="h-9 rounded-md border border-slate-200 px-2 text-sm dark:border-slate-800" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="merged">Merged</option>
          </select>
          <Input placeholder="Search PRs" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-48" />
        </div>
      </div>

      <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {loading ? (
          <div className="py-6 text-center text-sm text-slate-500">Loading pull requests…</div>
        ) : pulls.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">No pull requests found.</div>
        ) : (
          pulls.map((p) => <PullItem key={p.id} pr={p} onClick={(pr) => setSelected(pr)} />)
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-500">Page {page} of {totalPages}</div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
          <Button variant="ghost" size="icon" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
        </div>
      </div>

      <PullModal pr={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

export default PullsPanel
