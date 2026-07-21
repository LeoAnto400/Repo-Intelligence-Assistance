import { beforeEach, describe, expect, it, vi } from 'vitest';
import { useChatStore } from './useChatStore';
import { queryService } from '../services/query';

vi.mock('../services/query', () => ({
  queryService: { queryRepository: vi.fn() },
}));

describe('useChatStore', () => {
  beforeEach(() => {
    useChatStore.setState({ messages: [], isLoading: false });
    vi.mocked(queryService.queryRepository).mockReset();
  });

  it('appends a user message and a completed assistant message on success', async () => {
    vi.mocked(queryService.queryRepository).mockResolvedValue({
      answer: 'Auth uses JWT.',
      source_files: ['src/auth.py'],
      retrieved_chunks: 2,
    });

    await useChatStore.getState().sendMessage('How does auth work?');

    const { messages, isLoading } = useChatStore.getState();
    expect(isLoading).toBe(false);
    expect(messages).toHaveLength(2);
    expect(messages[0]).toMatchObject({ role: 'user', content: 'How does auth work?', status: 'complete' });
    expect(messages[1]).toMatchObject({
      role: 'assistant',
      status: 'complete',
      content: 'Auth uses JWT.',
      sourceFiles: ['src/auth.py'],
      retrievedChunks: 2,
    });
    expect(queryService.queryRepository).toHaveBeenCalledWith('How does auth work?');
  });

  it('marks the assistant message as errored when the query fails', async () => {
    vi.mocked(queryService.queryRepository).mockRejectedValue(new Error('Network down'));

    await useChatStore.getState().sendMessage('How does auth work?');

    const { messages, isLoading } = useChatStore.getState();
    expect(isLoading).toBe(false);
    expect(messages[1]).toMatchObject({ status: 'error', content: 'Network down' });
  });

  it('ignores empty or whitespace-only questions', async () => {
    await useChatStore.getState().sendMessage('   ');

    expect(useChatStore.getState().messages).toHaveLength(0);
    expect(queryService.queryRepository).not.toHaveBeenCalled();
  });

  it('ignores new messages while a previous one is still loading', async () => {
    let resolveQuery: (value: { answer: string; source_files: string[]; retrieved_chunks: number }) => void = () => {};
    vi.mocked(queryService.queryRepository).mockReturnValue(
      new Promise((resolve) => {
        resolveQuery = resolve;
      })
    );

    const firstSend = useChatStore.getState().sendMessage('First question');
    await useChatStore.getState().sendMessage('Second question while loading');

    expect(queryService.queryRepository).toHaveBeenCalledTimes(1);
    expect(queryService.queryRepository).toHaveBeenCalledWith('First question');

    resolveQuery({ answer: 'Answer', source_files: [], retrieved_chunks: 0 });
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
