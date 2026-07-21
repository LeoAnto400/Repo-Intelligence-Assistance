import { create, type StoreApi } from 'zustand';
import { queryService } from '../services/query';
import { queryStreamClient } from '../services/queryStream';
import { getErrorMessage, normalizeQueryResponse } from '@/lib/runtime-safety';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sourceFiles?: string[];
  retrievedChunks?: number;
  /** Assistant messages only: lifecycle of the answer this bubble represents. */
  status?: 'pending' | 'error' | 'complete';
  /** Assistant messages only: the question that produced this bubble, kept for retry. */
  question?: string;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  sendMessage: (question: string) => Promise<void>;
  retryMessage: (assistantMessageId: string) => Promise<void>;
  clearChat: () => void;
}

function createId(): string {
  return Math.random().toString(36).substring(2, 10);
}

type SetState = StoreApi<ChatState>['setState'];

function appendToken(assistantMessageId: string, text: string, set: SetState): void {
  set((state) => ({
    messages: state.messages.map((message) =>
      message.id === assistantMessageId ? { ...message, content: message.content + text } : message
    ),
  }));
}

function finalizeMessage(
  assistantMessageId: string,
  response: { answer: string; source_files: string[]; retrieved_chunks: number },
  set: SetState
): void {
  set((state) => ({
    isLoading: false,
    messages: state.messages.map((message) =>
      message.id === assistantMessageId
        ? {
            ...message,
            status: 'complete',
            content: response.answer,
            sourceFiles: response.source_files,
            retrievedChunks: response.retrieved_chunks,
            timestamp: new Date(),
          }
        : message
    ),
  }));
}

async function runQuery(assistantMessageId: string, question: string, set: SetState): Promise<void> {
  try {
    const result = await queryStreamClient.query(question, {
      onToken: (text) => appendToken(assistantMessageId, text, set),
    });
    finalizeMessage(
      assistantMessageId,
      { answer: result.answer, source_files: result.sourceFiles, retrieved_chunks: result.retrievedChunks },
      set
    );
    return;
  } catch {
    // Streaming path unavailable (e.g. a proxy that blocks websocket
    // upgrades) - fall back to the blocking REST endpoint below rather than
    // surfacing what may just be a transport-level failure.
  }

  try {
    const response = normalizeQueryResponse(await queryService.queryRepository(question));
    finalizeMessage(assistantMessageId, response, set);
  } catch (err: unknown) {
    const errorMessage = getErrorMessage(err, 'Failed to get answer from assistant.');
    set((state) => ({
      isLoading: false,
      messages: state.messages.map((message) =>
        message.id === assistantMessageId ? { ...message, status: 'error', content: errorMessage } : message
      ),
    }));
  }
}

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [],
  isLoading: false,

  sendMessage: async (question: string) => {
    const trimmed = question.trim();
    if (!trimmed || get().isLoading) return;

    const userMessage: ChatMessage = {
      id: createId(),
      role: 'user',
      content: trimmed,
      timestamp: new Date(),
      status: 'complete',
    };
    const assistantMessageId = createId();
    const pendingMessage: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      status: 'pending',
      question: trimmed,
    };

    set((state) => ({
      messages: [...state.messages, userMessage, pendingMessage],
      isLoading: true,
    }));

    await runQuery(assistantMessageId, trimmed, set);
  },

  retryMessage: async (assistantMessageId: string) => {
    const target = get().messages.find((message) => message.id === assistantMessageId);
    if (!target?.question || get().isLoading) return;

    set((state) => ({
      isLoading: true,
      messages: state.messages.map((message) =>
        message.id === assistantMessageId ? { ...message, status: 'pending', content: '' } : message
      ),
    }));

    await runQuery(assistantMessageId, target.question, set);
  },

  clearChat: () => set({ messages: [], isLoading: false }),
}));
