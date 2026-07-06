import { useEffect, useMemo, useState } from 'react'
import type { FileNode } from '../../services/mockFiles'

const extensionToLanguage: Record<string, string> = {
  tsx: 'tsx',
  ts: 'typescript',
  js: 'javascript',
  json: 'json',
  md: 'markdown',
  markdown: 'markdown',
  java: 'java',
}

function getLanguage(node: FileNode) {
  return extensionToLanguage[node.language || ''] || node.language || 'plaintext'
}

export function CodeViewer({ node, highlightLines }: { node: FileNode | null; highlightLines?: number[] }) {
  const [searchQuery, setSearchQuery] = useState('')
  const [copySuccess, setCopySuccess] = useState('')

  const lines = useMemo(() => node?.content?.split('\n') ?? [], [node])

  const highlightedHtml = useMemo(() => {
    if (!node) return []
    const language = getLanguage(node)
    const raw = node.content || ''
    let html = ''
    const hljs = (window as any).hljs
    if (hljs) {
      const languageDetected = hljs.getLanguage(language) ? language : 'plaintext'
      html = hljs.highlight(raw, { language: languageDetected }).value
    } else {
      html = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }
    return html.split('\n')
  }, [node])

  const searchMatches = useMemo(() => {
    if (!searchQuery.trim()) return new Set<number>()
    const needle = searchQuery.toLowerCase()
    return new Set(lines.map((line, index) => (line.toLowerCase().includes(needle) ? index + 1 : -1)).filter((n) => n !== -1))
  }, [lines, searchQuery])

  useEffect(() => {
    if (!copySuccess) return
    const timeout = window.setTimeout(() => setCopySuccess(''), 1500)
    return () => window.clearTimeout(timeout)
  }, [copySuccess])

  if (!node) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-200/70 bg-white/80 p-8 text-center text-slate-500 shadow-sm dark:border-slate-800 dark:bg-slate-900/60 dark:text-slate-400">
        Select a file to view its contents.
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-slate-950/95 p-4 shadow-sm dark:border-slate-800">
      <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">{node.name}</h3>
          <p className="text-sm text-slate-400">{node.path}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-slate-800 px-2 py-1 text-xs text-slate-300">{node.language || 'txt'}</span>
          <button
            type="button"
            onClick={async () => {
              await navigator.clipboard.writeText(node.content || '')
              setCopySuccess('Copied')
            }}
            className="rounded-md bg-slate-800 px-3 py-2 text-xs font-medium text-slate-200 hover:bg-slate-700"
          >
            {copySuccess || 'Copy'}
          </button>
        </div>
      </div>

      <div className="mb-4 flex items-center gap-3">
        <label className="text-sm text-slate-400">Search within file</label>
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search text..."
          className="min-w-0 flex-1 rounded-md border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-100 outline-none focus:border-slate-600"
        />
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950 px-0 py-2">
        <div className="grid grid-cols-[48px_minmax(0,1fr)] text-slate-500 text-xs uppercase tracking-[0.16em]">
          <div className="px-3 py-2">Line</div>
          <div className="px-3 py-2">Code</div>
        </div>
        <div className="max-h-[560px] overflow-auto">
          {lines.map((_, index) => {
            const lineNumber = index + 1
            const isSearchMatch = searchMatches.has(lineNumber)
            const isAIHighlight = highlightLines?.includes(lineNumber)
            return (
              <div
                key={lineNumber}
                className={`grid grid-cols-[48px_minmax(0,1fr)] border-t border-slate-900 text-sm ${isAIHighlight ? 'bg-slate-800' : isSearchMatch ? 'bg-slate-900' : 'bg-slate-950'} text-slate-100`}
              >
                <div className="px-3 py-1 text-right text-slate-500">{lineNumber}</div>
                <div className="px-3 py-1 font-mono whitespace-pre-wrap break-words">
                  <span dangerouslySetInnerHTML={{ __html: highlightedHtml[index] || '' }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default CodeViewer
