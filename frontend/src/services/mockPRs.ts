export type PullRequest = {
  id: number
  number: number
  title: string
  author: string
  status: 'open' | 'closed' | 'merged'
  labels: string[]
  merge_date?: string
  reviewers?: string[]
  created_at: string
  updated_at: string
  body?: string
}

export async function fetchPulls({ page = 1, perPage = 10, q = '', status = '' }: { page?: number; perPage?: number; q?: string; status?: string }) {
  const res = await fetch('/api/v1/repository')
  if (!res.ok) throw new Error(`Pull request failed: ${res.status}`)
  const data = await res.json()

  let list = ((data.pull_requests || []) as PullRequest[]).slice()
  if (q) {
    const k = q.toLowerCase()
    list = list.filter((p) => p.title.toLowerCase().includes(k) || p.author.toLowerCase().includes(k) || p.number.toString() === q)
  }
  if (status) {
    list = list.filter((p) => p.status === status)
  }

  const total = list.length
  const start = (page - 1) * perPage
  const pulls = list.slice(start, start + perPage)
  return { pulls, total }
}
