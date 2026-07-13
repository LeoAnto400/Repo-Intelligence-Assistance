import { create } from 'zustand';
import { repositoryService } from '../services/repository';
import { CommitMetadata, PullRequestMetadata, RepositoryMetadata } from '@/types/api';
import { getErrorMessage, normalizeRepositoryContext } from '@/lib/runtime-safety';

interface RepoState {
  repository: string | null;
  repoUrl: string | null;
  metadata: RepositoryMetadata | null;
  files: Array<Record<string, unknown>>;
  commits: Array<CommitMetadata>;
  pullRequests: Array<PullRequestMetadata>;
  isLoading: boolean;
  error: string | null;
  fetchContext: () => Promise<void>;
  reset: () => void;
}

export const useRepoStore = create<RepoState>((set) => ({
  repository: null,
  repoUrl: null,
  metadata: null,
  files: [],
  commits: [],
  pullRequests: [],
  isLoading: false,
  error: null,

  fetchContext: async () => {
    set({ isLoading: true, error: null });
    try {
      const response = normalizeRepositoryContext(await repositoryService.getRepositoryContext());
      set({
        repository: response.repository,
        repoUrl: response.repo_url,
        metadata: response.metadata,
        files: response.files,
        commits: response.commits,
        pullRequests: response.pull_requests,
        isLoading: false,
      });
    } catch (err: unknown) {
      set({
        isLoading: false,
        error: getErrorMessage(err, 'Failed to fetch repository context'),
      });
    }
  },

  reset: () =>
    set({
      repository: null,
      repoUrl: null,
      metadata: null,
      files: [],
      commits: [],
      pullRequests: [],
      isLoading: false,
      error: null,
    }),
}));


