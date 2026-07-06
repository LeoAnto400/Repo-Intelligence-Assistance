import { useEffect, useState } from 'react'
import { fetchRepositoryOverview, type RepositoryOverview } from '../../services/overview'
import { Spinner } from '../ui/spinner'

export function RepositoryOverviewPanel() {
  const [overview, setOverview] = useState<RepositoryOverview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setLoading(true)
    fetchRepositoryOverview()
      .then((data) => {
        if (!active) return
        setOverview(data)
      })
      .catch((err) => {
        if (!active) return
        setError(err.message || 'Unable to load overview')
      })
      .finally(() => {
        if (!active) return
        setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex items-center gap-3 text-slate-600 dark:text-slate-300">
          <Spinner />
          <span>Loading repository overview...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200/70 bg-rose-50/80 p-6 text-rose-700 shadow-sm dark:border-rose-800/70 dark:bg-rose-900/40 dark:text-rose-100">
        <p className="font-medium">Overview load failed</p>
        <p className="mt-2 text-sm">{error}</p>
      </div>
    )
  }

  if (!overview) {
    return null
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <div className="mb-5">
        <h2 className="text-lg font-semibold">Repository Overview</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Generated summary and architecture details from the backend.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel title="Summary">{overview.summary}</Panel>
        <Panel title="Purpose">{overview.purpose}</Panel>
        <Panel title="Architecture">{overview.architecture}</Panel>
        <Panel title="Entry Point">{overview.entry_point}</Panel>
        <Panel title="Authentication">{overview.authentication}</Panel>
        <Panel title="Database">{overview.database}</Panel>
        <Panel title="Build Tool">{overview.build_tool}</Panel>
        <Panel title="Technologies"><BulletList items={overview.technologies} /></Panel>
        <Panel title="Main Modules"><BulletList items={overview.main_modules} /></Panel>
        <Panel title="Folder Structure">{overview.folder_structure}</Panel>
      </div>
    </div>
  )
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/80">
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      <div className="mt-2 text-sm text-slate-600 dark:text-slate-300">{children}</div>
    </div>
  )
}

function BulletList({ items }: { items: string[] }) {
  if (!items || items.length === 0) {
    return <span className="text-slate-500 dark:text-slate-400">Not available</span>
  }

  return (
    <ul className="space-y-1 pl-4 text-slate-600 dark:text-slate-300">
      {items.map((item, idx) => (
        <li key={idx} className="list-disc">{item}</li>
      ))}
    </ul>
  )
}

export default RepositoryOverviewPanel
