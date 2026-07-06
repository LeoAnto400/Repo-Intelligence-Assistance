export type RepoDetails = {
  name: string
  description?: string
  owner: string
  stars: number
  forks: number
  primary_language?: string
  license?: string
  default_branch?: string
  latest_commit?: string
  size_kb?: number
  visibility?: 'public' | 'private'
  open_issues?: number
  contributors?: Array<{ login: string; contributions: number }>
}

export const mockRepo: RepoDetails = {
  name: 'repo-intelligence-assistance',
  description: 'Repository intelligence assistant starter UI',
  owner: 'leoan',
  stars: 12,
  forks: 3,
  primary_language: 'TypeScript',
  license: 'MIT',
  default_branch: 'main',
  latest_commit: 'Fix: wire up ingest API',
  size_kb: 4520,
  visibility: 'public',
  open_issues: 5,
  contributors: [
    { login: 'leoan', contributions: 80 },
    { login: 'alice', contributions: 12 },
    { login: 'bob', contributions: 7 },
  ],
}
