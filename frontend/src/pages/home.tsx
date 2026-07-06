import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Spinner } from '../components/ui/spinner'
import { ingestRepository } from '../services/api'

export function HomePage() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(-1)
  const abortRef = useRef<AbortController | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
    }
  }, [])

  function validateRepo(u: string) {
    if (!u) return 'Please enter a GitHub repository URL.'
    // Basic GitHub repo URL validation: https://github.com/owner/repo
    const re = /^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/
    return re.test(u) ? null : 'Please enter a valid GitHub repository URL (e.g. https://github.com/owner/repo).'
  }

  function onAnalyze(e?: React.FormEvent) {
    e?.preventDefault()
    setSuccess(false)
    const v = validateRepo(url.trim())
    if (v) {
      setError(v)
      return
    }

    setError(null)
    setLoading(true)
    setCurrentStageIndex(0)

    const controller = new AbortController()
    abortRef.current = controller

    ingestRepository(
      url.trim(),
      (p) => {
        const s = (p.stage || '').toLowerCase()
        if (s.includes('clone')) setCurrentStageIndex(0)
        else if (s.includes('chunk')) setCurrentStageIndex(1)
        else if (s.includes('embed') || s.includes('embedding')) setCurrentStageIndex(2)
        else if (s.includes('index')) setCurrentStageIndex(3)
      },
      controller.signal,
    )
      .then(() => {
        setLoading(false)
        setSuccess(true)
        // small delay to show completion
        setTimeout(() => navigate('/repository'), 600)
      })
      .catch((err) => {
        if (err.name === 'AbortError') return
        setLoading(false)
        setError(err.message || 'Ingestion failed. Please try again.')
      })
  }

  const stages = [
    'Cloning repository...',
    'Chunking...',
    'Generating embeddings...',
    'Indexing...',
  ]

  return (
    <div className="flex w-full flex-1 items-center justify-center">
      <div className="mx-auto w-full max-w-3xl space-y-8 px-4">
        <section className="rounded-3xl border border-slate-200/70 bg-white/80 p-10 shadow-lg backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
          <div className="text-center">
            <p className="mb-3 inline-flex rounded-full bg-indigo-100 px-3 py-1 text-sm font-medium text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
              AI-powered repository insights
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              GitHub Repository Intelligence Assistant
            </h1>
            <p className="mt-3 text-lg text-slate-600 dark:text-slate-300">
              Analyze repositories using AI-powered semantic search and conversations.
            </p>
          </div>

          <form onSubmit={onAnalyze} className="mx-auto mt-8 max-w-2xl">
            <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">
              GitHub Repository URL
            </label>
            <div className="flex gap-3">
              <Input
                placeholder="https://github.com/owner/repo"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                aria-invalid={!!error}
                aria-describedby={error ? 'repo-error' : undefined}
              />

              <Button type="submit" className="whitespace-nowrap" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <Spinner className="h-4 w-4" />
                    Ingesting...
                  </span>
                ) : (
                  'Analyze Repository'
                )}
              </Button>
            </div>

            {error && (
              <p id="repo-error" className="mt-3 text-sm text-rose-600">
                {error}
              </p>
            )}

            <div className="mt-6 grid gap-2">
              {stages.map((s, i) => (
                <div
                  key={s}
                  className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm ${
                    i === currentStageIndex
                      ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
                      : 'bg-transparent text-slate-500'
                  }`}
                >
                  <span className="w-4">{i === currentStageIndex ? <Spinner className="h-4 w-4" /> : '·'}</span>
                  <span>{s}</span>
                </div>
              ))}
            </div>

            {success && !loading && (
              <div className="mt-3 rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-700">
                Repository ingested. Redirecting to repository view...
              </div>
            )}
          </form>
        </section>
      </div>
    </div>
  )
}

export default HomePage
