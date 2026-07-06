export type RepositoryOverview = {
  summary: string
  purpose: string
  architecture: string
  technologies: string[]
  folder_structure: string
  main_modules: string[]
  entry_point: string
  authentication: string
  database: string
  build_tool: string
}

export async function fetchRepositoryOverview() {
  const res = await fetch('/query', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: 'Provide a repository overview with summary, purpose, architecture, technologies, folder structure, main modules, entry point, authentication, database, and build tool.' }),
  })

  if (!res.ok) {
    throw new Error(`Overview request failed: ${res.status}`)
  }

  const data = await res.json()
  const answer = data.answer || ''

  return {
    summary: extractField(answer, 'Repository Summary') || answer,
    purpose: extractField(answer, 'Purpose'),
    architecture: extractField(answer, 'Architecture'),
    technologies: extractList(answer, 'Technologies'),
    folder_structure: extractField(answer, 'Folder Structure'),
    main_modules: extractList(answer, 'Main Modules'),
    entry_point: extractField(answer, 'Entry Point'),
    authentication: extractField(answer, 'Authentication'),
    database: extractField(answer, 'Database'),
    build_tool: extractField(answer, 'Build Tool'),
  }
}

function extractField(text: string, label: string) {
  const regex = new RegExp(`${label}:?\\s*([\s\S]*?)(?:\\n\\n|$)`, 'i')
  const match = text.match(regex)
  return match?.[1]?.trim() ?? ''
}

function extractList(text: string, label: string) {
  const field = extractField(text, label)
  if (!field) return []
  return field.split(/\n|,|;/).map((item) => item.replace(/^[-*\s]+/, '').trim()).filter(Boolean)
}
