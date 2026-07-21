import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatStore } from './useChatStore';
import { queryService } from '../services/query';
import { queryStreamClient } from '../services/queryStream';

vi.mock('../services/query', () => ({
  queryService: { queryRepository: vi.fn() },
}));

vi.mock('../services/queryStream', () => ({
  queryStreamClient: { query: vi.fn() },
}));

describe('useChatStore', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], isLoading: false });
    vi.mocked(queryService.queryRepository).mockReset();
    vi.mocked(queryStreamClient.query).mockReset();
  });

  it('streams tokens progressively then finalizes with the done event answer', async () => {
    const contentSnapshots: string[] = [];
    const unsubscribe = useChatStore.subscribe((state) => {
      const assistant = state.messages.find((m) => m.role === 'assistant');
      if (assistant) contentSnapshots.push(assistant.content);
    });

    vi.mocked(queryStreamClient.query).mockImplementation(async (_question, handlers) => {
      handlers.onToken('Auth ');
      handlers.onToken('uses JWT.');
      return { answer: 'Auth uses JWT tokens.', sourceFiles: ['src/auth.py'], retrievedChunks: 2 };
    });

    await useChatStore.getState().sendMessage('How does auth work?');
    unsubscribe();

    expect(contentSnapshots).toContain('Auth ');
    expect(contentSnapshots).toContain('Auth uses JWT.');

    const { messages, isLoading } = useChatStore.getState();
    expect(isLoading).toBe(false);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: 'user', content: 'How does auth work?', status: 'complete' });
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      status: 'complete',
      content: 'Auth uses JWT tokens.',
      sourceFiles: ['src/auth.py'],
      retrievedChunks: 2,
    });
    expect(queryService.queryRepository).not.toHaveBeenCalled();
  });

  it('falls back to the REST endpoint when the websocket stream fails', async () => {
    vi.mocked(queryStreamClient.query).mockRejectedValue(new Error('Failed to connect to the assistant.'));
    vi.mocked(queryService.queryRepository).mockResolvedValue({
      answer: 'Auth uses JWT.',
      source_files: ['src/auth.py'],
      retrieved_chunks: 2,
    });

    await useChatStore.getState().sendMessage('How does auth work?');

    const { messages, isLoading } = useChatStore.getState();
    expect(isLoading).toBe(false);
    expect(messages[1]).toMatchObject({
      status: 'complete',
      content: 'Auth uses JWT.',
      sourceFiles: ['src/auth.py'],
      retrievedChunks: 2,
    });
    expect(queryService.queryRepository).toHaveBeenCalledWith('How does auth work?');
  });

  it('marks the assistant message as errored when both the stream and the REST fallback fail', async () => {
    vi.mocked(queryStreamClient.query).mockRejectedValue(new Error('Connection to the assistant was lost.'));
    vi.mocked(queryService.queryRepository).mockRejectedValue(new Error('Network down'));

    await useChatStore.getState().sendMessage('How does auth work?');

    const { messages, isLoading } = useChatStore.getState();
    expect(isLoading).toBe(false);
    expect(messages[1]).toMatchObject({ status: 'error', content: 'Network down' });
  });

  it('ignores empty or whitespace-only questions', async () => {
    await useChatStore.getState().sendMessage('   ');

    expect(useChatStore.getState().messages).toHaveLength(0);
    expect(queryStreamClient.query).not.toHaveBeenCalled();
    expect(queryService.queryRepository).not.toHaveBeenCalled();
  });

  it('ignores new messages while a previous one is still loading', async () => {
    let resolveQuery: (value: { answer: string; sourceFiles: string[]; retrievedChunks: number }) => void = () => {};
    vi.mocked(queryStreamClient.query).mockReturnValue(
      new Promise((resolve) => {
        resolveQuery = resolve;
      })
    );

    const firstSend = useChatStore.getState().sendMessage('First question');
    await useChatStore.getState().sendMessage('Second question while loading');

    expect(queryStreamClient.query).toHaveBeenCalledTimes(1);
    expect(queryStreamClient.query).toHaveBeenCalledWith('First question', expect.anything());

    resolveQuery({ answer: 'Answer', sourceFiles: [], retrievedChunks: 0 });
    await firstSend;
  });

  it('clearChat resets messages and loading state', () => {
    useChatStore.setState({
      messages: [{ id: '1', role: 'user', content: 'hi', timestamp: new Date(), status: 'complete' }],
      isLoading: true,
    });

    useChatStore.getState().clearChat();

    expect(useChatStore.getState()).toMatchObject({ messages: [], isLoading: false });
  });
});
