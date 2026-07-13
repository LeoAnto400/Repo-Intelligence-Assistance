import { BaseService } from '@/services/base-service';
import { RepositoryContextResponse } from '@/types/api';

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
}

export const repositoryService = RepositoryService.getInstance();
