import { useMemo, useState } from 'react'
import { ChevronDown, ChevronRight, FileText, Folder, Code2, FileJson, File } from 'lucide-react'
import type { FileNode } from '../../services/mockFiles'

const iconMap: Record<string, typeof FileText> = {
  tsx: Code2,
  ts: Code2,
  js: Code2,
  json: FileJson,
  md: FileText,
  markdown: FileText,
}

function getIcon(node: FileNode) {
  if (node.type === 'folder') return Folder
  return iconMap[node.language ?? ''] || File
}

function FileTreeItem({ node, expandedNodes, toggle, onSelect, selectedPath }: { node: FileNode; expandedNodes: Set<string>; toggle: (id: string) => void; onSelect: (node: FileNode) => void; selectedPath: string | null }) {
  const isExpanded = expandedNodes.has(node.id)
  const Icon = getIcon(node)

  if (node.type === 'folder') {
    return (
      <div>
        <button type="button" onClick={() => toggle(node.id)} className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800">
          {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          <Icon className="h-4 w-4" />
          <span>{node.name}</span>
        </button>
        {isExpanded && node.children?.length ? (
          <div className="ml-5 border-l border-slate-200 pl-3 dark:border-slate-800">
            {node.children.map((child) => (
              <FileTreeItem key={child.id} node={child} expandedNodes={expandedNodes} toggle={toggle} onSelect={onSelect} selectedPath={selectedPath} />
            ))}
          </div>
        ) : null}
      </div>
    )
  }

  return (
    <button type="button" onClick={() => onSelect(node)} className={`flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm ${selectedPath === node.path ? 'bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
      <Icon className="h-4 w-4" />
      <span className="truncate">{node.name}</span>
    </button>
  )
}

export function FileExplorer({ files, selectedPath, onSelect }: { files: FileNode[]; selectedPath: string | null; onSelect: (node: FileNode) => void }) {
  const [query, setQuery] = useState('')
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['src']))

  const filtered = useMemo(() => {
    if (!query.trim()) return files
    const q = query.toLowerCase()

    const filterNode = (node: FileNode): FileNode | null => {
      if (node.type === 'folder') {
        const children = node.children?.map(filterNode).filter(Boolean) as FileNode[]
        if (children.length) return { ...node, children }
        if (node.name.toLowerCase().includes(q)) return node
        return null
      }
      if (node.name.toLowerCase().includes(q) || node.path.toLowerCase().includes(q)) return node
      return null
    }

    return files.map(filterNode).filter(Boolean) as FileNode[]
  }, [files, query])

  const toggle = (id: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="rounded-2xl border border-slate-200/70 bg-white/80 p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900/60">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Files</h3>
          <p className="text-sm text-slate-500 dark:text-slate-400">Browse repository files.</p>
        </div>
        <div className="text-xs uppercase tracking-[0.18em] text-slate-400">Tree</div>
      </div>

      <div className="mt-4">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search files"
          className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-slate-300 dark:border-slate-800 dark:bg-slate-950"
        />
      </div>

      <div className="mt-4 max-h-[520px] overflow-y-auto space-y-1">
        {filtered.length ? filtered.map((node) => (
          <FileTreeItem key={node.id} node={node} expandedNodes={expandedNodes} toggle={toggle} onSelect={onSelect} selectedPath={selectedPath} />
        )) : (
          <div className="py-6 text-center text-sm text-slate-500 dark:text-slate-400">No matching files.</div>
        )}
      </div>
    </div>
  )
}

export default FileExplorer
