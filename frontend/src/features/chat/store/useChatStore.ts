import { create, type StoreApi } from 'zustand';
import { queryService } from '../services/query';
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

async function runQuery(assistantMessageId: string, question: string, set: SetState): Promise<void> {
  try {
    const response = normalizeQueryResponse(await queryService.queryRepository(question));
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
