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

const SAMPLE: Commit[] = Array.from({ length: 57 }).map((_, i) => {
  const idx = 57 - i
  return {
    hash: `abcdef${(1000 + idx).toString(16)}`.slice(0, 12),
    author: ['Alice', 'Bob', 'Charlie', 'Dana'][i % 4],
    message: `Fix issue #${idx} and improve performance (${i % 3 === 0 ? 'refactor' : 'test'})`,
    time: new Date(Date.now() - i * 1000 * 60 * 60 * 6).toISOString(),
    branch: i % 5 === 0 ? 'feature/fast-path' : i % 3 === 0 ? 'main' : 'develop',
    filesChanged: (i % 5) + 1,
    additions: (i % 10) + 1,
    deletions: (i % 4),
    diff: `--- a/file${i}.ts\n+++ b/file${i}.ts\n@@ -1,4 +1,4 @@\n-console.log('old')\n+console.log('new')\n`,
  }
})

export async function fetchCommits({ page = 1, perPage = 10, q = '' }: { page?: number; perPage?: number; q?: string }) {
  // fake network latency
  await new Promise((r) => setTimeout(r, 200))

  let list = SAMPLE.slice()
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
