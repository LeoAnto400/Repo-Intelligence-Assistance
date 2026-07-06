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

const SAMPLE: PullRequest[] = Array.from({ length: 23 }).map((_, i) => {
  const n = 100 - i
  const status = i % 7 === 0 ? 'merged' : i % 5 === 0 ? 'closed' : 'open'
  return {
    id: n,
    number: n,
    title: `Improve feature ${n} and add tests`,
    author: ['alice', 'bob', 'carol', 'dave'][i % 4],
    status: status as PullRequest['status'],
    labels: i % 3 === 0 ? ['bug', 'high priority'] : i % 4 === 0 ? ['enhancement'] : [],
    merge_date: status === 'merged' ? new Date(Date.now() - i * 1000 * 60 * 60 * 24).toISOString() : undefined,
    reviewers: ['maintainer1', 'maintainer2'].slice(0, (i % 3) + 1),
    created_at: new Date(Date.now() - i * 1000 * 60 * 60 * 24 * 2).toISOString(),
    updated_at: new Date(Date.now() - i * 1000 * 60 * 60 * 6).toISOString(),
    body: `This PR updates files and improves behavior for case ${n}.`,
  }
})

export async function fetchPulls({ page = 1, perPage = 10, q = '', status = '' }: { page?: number; perPage?: number; q?: string; status?: string }) {
  await new Promise((r) => setTimeout(r, 200))
  let list = SAMPLE.slice()
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
