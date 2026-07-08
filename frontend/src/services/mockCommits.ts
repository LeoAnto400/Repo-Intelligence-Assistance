export type Commit = {
  hash: string
  author: string
  message: string
  time: string // ISO
  branch: string
  filesChanged?: number
  additions?: number
  deletions?: number
  diff?: string
}

export async function fetchCommits({ page = 1, perPage = 10, q = '' }: { page?: number; perPage?: number; q?: string }) {
  const res = await fetch('/api/v1/repository')
  if (!res.ok) throw new Error(`Commit request failed: ${res.status}`)
  const data = await res.json()

  let list = ((data.commits || []) as Commit[]).slice()
  if (q) {
    const k = q.toLowerCase()
    list = list.filter((c) => c.hash.includes(k) || c.author.toLowerCase().includes(k) || c.message.toLowerCase().includes(k))
  }

  const total = list.length
  const start = (page - 1) * perPage
  const end = start + perPage
  const commits = list.slice(start, end)

  return { commits, total }
}
