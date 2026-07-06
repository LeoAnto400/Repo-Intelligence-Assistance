export interface RepositorySummary {
  name: string
  description?: string
  stars?: number
}

export const mockRepository: RepositorySummary = {
  name: 'repo-intelligence-assistance',
  description: 'Repository intelligence assistant starter UI',
  stars: 0,
}
