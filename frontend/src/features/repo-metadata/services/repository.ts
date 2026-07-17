import { BaseService } from '@/services/base-service';
import { RepositoryContextResponse, RepositorySummary } from '@/types/api';

export class RepositoryService extends BaseService {
  private static instance: RepositoryService;

  private constructor() {
    super();
  }

  public static getInstance(): RepositoryService {
    if (!RepositoryService.instance) {
      RepositoryService.instance = new RepositoryService();
    }
    return RepositoryService.instance;
  }

  /**
   * Fetches metadata and context for the active ingested repository.
   */
  public async getRepositoryContext(): Promise<RepositoryContextResponse> {
    return this.get<RepositoryContextResponse>('/repository');
  }

  /**
   * Lists every repository already indexed in the vector store.
   */
  public async listRepositories(): Promise<RepositorySummary[]> {
    return this.get<RepositorySummary[]>('/repositories');
  }

  /**
   * Activates a previously ingested repository without re-ingesting it.
   */
  public async selectRepository(repository: string): Promise<RepositoryContextResponse> {
    return this.post<RepositoryContextResponse>(`/repositories/${encodeURIComponent(repository)}/select`);
  }
}

export const repositoryService = RepositoryService.getInstance();
