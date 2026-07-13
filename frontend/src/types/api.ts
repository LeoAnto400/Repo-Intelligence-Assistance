export interface IngestRequest {
  repo_url: string;
}

export interface IngestResponse {
  status: string;
  repository: string;
  files_processed: number;
  chunks_created: number;
  repo_url?: string;
}

export interface QueryRequest {
  question: string;
}

export interface QueryResponse {
  answer: string;
  source_files: string[];
  retrieved_chunks: number;
}

export interface CommitMetadata {
  sha: string;
  message: string;
  author: string;
  date: string;
  [key: string]: unknown;
}

export interface PullRequestMetadata {
  number: number;
  title: string;
  state: string;
  author: string;
  created_at: string;
  [key: string]: unknown;
}

export interface RepositoryMetadata {
  name?: string | null;
  full_name?: string | null;
  owner?: string | null;
  description?: string | null;
  stars?: number | null;
  forks?: number | null;
  default_branch?: string | null;
  primary_language?: string | null;
  updated_at?: string | null;
  last_updated?: string | null;
  summary?: string | null;
  ai_summary?: string | null;
  repository_summary?: string | null;
  technologies?: string[] | null;
  detected_technologies?: string[] | null;
  suggested_questions?: string[] | null;
  [key: string]: unknown;
}

export interface RepositoryContextResponse {
  repository: string;
  repo_url: string;
  metadata: RepositoryMetadata;
  files: Array<Record<string, unknown>>;
  commits: Array<CommitMetadata>;
  pull_requests: Array<PullRequestMetadata>;
}



