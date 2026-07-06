import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-3xl border border-slate-200/70 bg-white/80 px-8 py-16 text-center shadow-sm shadow-slate-200/60 backdrop-blur dark:border-slate-800 dark:bg-slate-900/70">
      <p className="mb-4 rounded-full bg-amber-100 px-3 py-1 text-sm font-medium text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
        404
      </p>
      <h1 className="text-3xl font-semibold tracking-tight">Page not found</h1>
      <p className="mt-3 max-w-xl text-slate-600 dark:text-slate-300">
        The route you requested does not exist yet. Return home to continue exploring the assistant shell.
      </p>
      <Link to="/" className="mt-6 inline-flex rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900">
        Go home
      </Link>
    </div>
  )
}
