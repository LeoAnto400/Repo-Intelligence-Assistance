import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import type { RepoDetails } from '../services/mockRepository'
import CommitsPanel from '../components/commits/CommitsPanel'
import PullsPanel from '../components/pulls/PullsPanel'
import FileExplorer from '../components/files/FileExplorer'
import CodeViewer from '../components/files/CodeViewer'
import RepositoryOverviewPanel from '../components/overview/RepositoryOverviewPanel'
import type { FileNode } from '../services/mockFiles'
import { fetchRepositoryContext, filesToTree } from '../services/repositoryData'

function findFileByQuery(nodes: FileNode[], fileQuery: string): FileNode | null {
  const normalized = fileQuery.replace(/^\/+/, '').toLowerCase()
  for (const node of nodes) {
    if (node.type === 'file') {
      if (node.path.toLowerCase() === normalized || node.name.toLowerCase() === normalized) {
        return node
      }
    }
    if (node.children) {
      const found = findFileByQuery(node.children, normalized)
      if (found) return found
    }
  }
  return null
}

function findFirstFile(nodes: FileNode[]): FileNode | null {
  for (const node of nodes) {
    if (node.type === 'file') return node
    if (node.children) {
      const found = findFirstFile(node.children)
      if (found) return found
    }
  }
  return null
}

export function RepositoryPage() {
  const location = useLocation()
  const [repo, setRepo] = useState<RepoDetails | null>(null)
  const [fileTree, setFileTree] = useState<FileNode[]>([])
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    setLoading(true)
    fetchRepositoryContext()
      .then((context) => {
        if (!mounted) return
        const tree = filesToTree(context.files)
        setRepo(context.metadata)
        setFileTree(tree)
        setSelectedFile(findFirstFile(tree))
        setError(null)
      })
      .catch((err) => {
        if (!mounted) return
        setError(err.message || 'Unable to load repository details.')
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })

    return () => {
      mounted = false
    }
  }, [])

  const { selectedNode, highlightLines } = useMemo(() => {
    const params = new URLSearchParams(location.search)
    const fileQuery = params.get('file')
    const line = params.get('line')
    const end = params.get('end')
    const selected = fileQuery ? findFileByQuery(fileTree, fileQuery) : selectedFile
    const lines: number[] = []
    if (selected && line) {
      const startLine = Number(line)
      const endLine = end ? Number(end) : startLine
      if (!Number.isNaN(startLine) && startLine > 0) {
        for (let i = startLine; i <= endLine; i += 1) lines.push(i)
      }
    }
    return { selectedNode: selected, highlightLines: lines }
  }, [fileTree, location.search, selectedFile])

  if (loading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center text-sm text-slate-500">
        Loading repository details...
      </div>
    )
  }

  if (error || !repo) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center">
        <h1 className="text-2xl font-semibold">No repository loaded</h1>
        <p className="mt-3 text-sm text-slate-500">{error || 'Ingest a GitHub repository first.'}</p>
        <Link className="mt-6 inline-flex rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white dark:bg-slate-100 dark:text-slate-950" to="/">
          Analyze a repository
        </Link>
      </div>
    )
  }

  return (
    <div className="w-full">
      <div className="mx-auto max-w-7xl space-y-6 px-4 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-semibold">{repo.name}</h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{repo.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
                <span>Owner: <strong className="text-slate-700 dark:text-slate-200">{repo.owner}</strong></span>
                <span>Stars: <strong>{repo.stars}</strong></span>
                <span>Forks: <strong>{repo.forks}</strong></span>
                <span>Primary: <strong>{repo.primary_language}</strong></span>
                <span>License: <strong>{repo.license}</strong></span>
                <span>Branch: <strong>{repo.default_branch}</strong></span>
              </div>
            </div>

            <div className="mt-3 flex items-center gap-3 sm:mt-0">
              <div className="rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
                Latest commit
              </div>
              <div className="rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
                Size: <strong>{repo.size_kb} KB</strong>
              </div>
              <div className="rounded-md bg-slate-100 px-3 py-2 text-sm dark:bg-slate-800">
                Visibility: <strong>{repo.visibility}</strong>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <FileExplorer files={fileTree} selectedPath={selectedNode?.path || null} onSelect={setSelectedFile} />

          <div className="space-y-6">
            <RepositoryOverviewPanel />
            <CodeViewer node={selectedNode} highlightLines={highlightLines} />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
                <h3 className="text-sm font-medium">Repository Summary</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">A quick summary of repository metadata and health.</p>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
                <h3 className="text-sm font-medium">Languages Used</h3>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{repo.primary_language}</p>
              </div>

              <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
                <h3 className="text-sm font-medium">Top Contributors</h3>
                <ul className="mt-2 text-sm text-slate-600 dark:text-slate-300">
                  {repo.contributors?.slice(0, 5).map((c) => (
                    <li key={c.login} className="flex items-center justify-between">
                      <span>{c.login}</span>
                      <span className="text-slate-500">{c.contributions}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
              <div className="md:col-span-2">
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
                  <h3 className="text-sm font-medium">Recent Activity</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Recent commits, PRs, and issues will surface here.</p>
                </div>
              </div>

              <div className="space-y-6">
                <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
                  <h3 className="text-sm font-medium">Architecture Summary</h3>
                  <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">(Placeholder) High-level architecture summary will appear here.</p>
                </div>

                <div className="space-y-6">
                  <CommitsPanel />
                  <PullsPanel />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RepositoryPage
