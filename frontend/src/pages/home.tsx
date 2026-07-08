import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Spinner } from '../components/ui/spinner'
import { ingestRepository } from '../services/api'

const STAGES = [
  { label: 'Cloning repository…', minMs: 0 },
  { label: 'Chunking source files…', minMs: 4000 },
  { label: 'Generating embeddings…', minMs: 10000 },
  { label: 'Indexing into vector store…', minMs: 20000 },
]

export function HomePage() {
  const [url, setUrl] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [currentStageIndex, setCurrentStageIndex] = useState<number>(-1)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const startTimeRef = useRef<number>(0)
  const navigate = useNavigate()

  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  function validateRepo(u: string) {
    if (!u) return 'Please enter a GitHub repository URL.'
    const re = /^https?:\/\/(www\.)?github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/
    return re.test(u) ? null : 'Please enter a valid GitHub repository URL (e.g. https://github.com/owner/repo).'
  }

  function startProgressTimer() {
    startTimeRef.current = Date.now()
    setCurrentStageIndex(0)

    timerRef.current = setInterval(() => {
      const elapsed = Date.now() - startTimeRef.current
      let newStage = 0
      for (let i = STAGES.length - 1; i >= 0; i--) {
        if (elapsed >= STAGES[i].minMs) {
          newStage = i
          break
        }
      }
      setCurrentStageIndex(newStage)
    }, 500)
  }

  function stopProgressTimer() {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
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
    startProgressTimer()

    const controller = new AbortController()
    abortRef.current = controller

    ingestRepository(url.trim(), controller.signal)
      .then(() => {
        stopProgressTimer()
        setCurrentStageIndex(STAGES.length - 1)
        setLoading(false)
        setSuccess(true)
        setTimeout(() => navigate('/repository'), 700)
      })
      .catch((err: unknown) => {
        if (err instanceof Error && err.name === 'AbortError') return
        stopProgressTimer()
        setCurrentStageIndex(-1)
        setLoading(false)
        const msg = err instanceof Error ? err.message : 'Ingestion failed. Please try again.'
        setError(msg)
      })
  }

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
                    Ingesting…
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

            {loading && (
              <div className="mt-6 grid gap-2">
                {STAGES.map((s, i) => (
                  <div
                    key={s.label}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors ${
                      i === currentStageIndex
                        ? 'bg-indigo-50 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300'
                        : i < currentStageIndex
                        ? 'text-emerald-600 dark:text-emerald-400'
                        : 'bg-transparent text-slate-400'
                    }`}
                  >
                    <span className="w-4 shrink-0">
                      {i === currentStageIndex ? (
                        <Spinner className="h-4 w-4" />
                      ) : i < currentStageIndex ? (
                        '✓'
                      ) : (
                        '·'
                      )}
                    </span>
                    <span>{s.label}</span>
                  </div>
                ))}
              </div>
            )}

            {success && !loading && (
              <div className="mt-3 rounded-md bg-emerald-50 px-4 py-2 text-sm text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">
                ✓ Repository ingested successfully. Redirecting…
              </div>
            )}
          </form>
        </section>
      </div>
    </div>
  )
}

export default HomePage
