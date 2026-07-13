import { BaseService } from '@/services/base-service';
import { QueryRequest, QueryResponse } from '@/types/api';

export class QueryService extends BaseService {
  private static instance: QueryService;

  private constructor() {
    super();
  }

  public static getInstance(): QueryService {
    if (!QueryService.instance) {
      QueryService.instance = new QueryService();
    }
    return QueryService.instance;
  }

  /**
   * Queries the active ingested repository.
   * @param question The question regarding the codebase.
   */
  public async queryRepository(question: string): Promise<QueryResponse> {
    const payload: QueryRequest = { question };
    return this.post<QueryResponse>('/query', payload);
  }
}

export const queryService = QueryService.getInstance();
