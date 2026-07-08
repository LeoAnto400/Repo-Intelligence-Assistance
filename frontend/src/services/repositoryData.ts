import type { FileNode } from './mockFiles'
import type { RepoDetails } from './mockRepository'

export type RepositoryFile = {
  path: string
  language: string
  content: string
}

export type RepositoryContext = {
  repository: string
  repo_url: string
  metadata: RepoDetails
  files: RepositoryFile[]
  commits: unknown[]
  pull_requests: unknown[]
}

export async function fetchRepositoryContext(): Promise<RepositoryContext> {
  const res = await fetch('/api/v1/repository')

  if (!res.ok) {
    const error = await readError(res)
    throw new Error(error || `Repository request failed: ${res.status}`)
  }

  return res.json()
}

export function filesToTree(files: RepositoryFile[]): FileNode[] {
  const root: FileNode[] = []
  const folders = new Map<string, FileNode>()

  for (const file of files.slice().sort((a, b) => a.path.localeCompare(b.path))) {
    const parts = file.path.split('/').filter(Boolean)
    let currentChildren = root
    let currentPath = ''

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}/${part}` : part
      const isFile = index === parts.length - 1

      if (isFile) {
        currentChildren.push({
          id: file.path,
          name: part,
          type: 'file',
          path: file.path,
          language: languageKey(file.language, part),
          content: file.content,
        })
        return
      }

      let folder = folders.get(currentPath)
      if (!folder) {
        folder = {
          id: currentPath,
          name: part,
          type: 'folder',
          path: currentPath,
          children: [],
        }
        folders.set(currentPath, folder)
        currentChildren.push(folder)
      }
      currentChildren = folder.children ?? []
    })
  }

  sortTree(root)
  return root
}

function sortTree(nodes: FileNode[]) {
  nodes.sort((a, b) => {
    if (a.type !== b.type) return a.type === 'folder' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
  nodes.forEach((node) => {
    if (node.children) sortTree(node.children)
  })
}

function languageKey(language: string, path: string) {
  const extension = path.split('.').pop()?.toLowerCase()
  if (extension) return extension
  return language.toLowerCase().replace(/\s+/g, '-')
}

async function readError(res: Response) {
  try {
    const data = await res.json()
    return data.detail || data.message || ''
  } catch {
    return res.text().catch(() => '')
  }
}
