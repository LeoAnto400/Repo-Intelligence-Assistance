import React, { useEffect, useState } from 'react'
import { fetchCommits, type Commit } from '../../services/mockCommits'
import { CommitItem } from './CommitItem'
import { CommitModal } from './CommitModal'
import { Input } from '../ui/input'
import { Button } from '../ui/button'

export function CommitsPanel() {
  const [commits, setCommits] = useState<Commit[]>([])
  const [page, setPage] = useState(1)
  const [perPage] = useState(10)
  const [total, setTotal] = useState(0)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<Commit | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchCommits({ page, perPage, q }).then((res) => {
      if (!mounted) return
      setCommits(res.commits)
      setTotal(res.total)
      setLoading(false)
    })
    return () => {
      mounted = false
    }
  }, [page, perPage, q])

  function onSearch(e?: React.FormEvent) {
    e?.preventDefault()
    setPage(1)
  }

  const totalPages = Math.max(1, Math.ceil(total / perPage))

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Commits</h3>
        <form onSubmit={onSearch} className="flex items-center gap-2">
          <Input placeholder="Search commits" value={q} onChange={(e) => setQ(e.target.value)} className="h-9 w-56" />
          <Button type="submit" variant="outline" size="icon">Search</Button>
        </form>
      </div>

      <div className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {loading ? (
          <div className="py-6 text-center text-sm text-slate-500">Loading commits…</div>
        ) : commits.length === 0 ? (
          <div className="py-6 text-center text-sm text-slate-500">No commits found.</div>
        ) : (
          commits.map((c) => <CommitItem key={c.hash} commit={c} onClick={(cm) => setSelected(cm)} />)
        )}
      </div>

      <div className="mt-4 flex items-center justify-between">
        <div className="text-sm text-slate-500">Page {page} of {totalPages}</div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
          <Button variant="ghost" size="icon" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
        </div>
      </div>

      <CommitModal commit={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

export default CommitsPanel
