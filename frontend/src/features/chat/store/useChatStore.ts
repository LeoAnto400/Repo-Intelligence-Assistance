import { create } from 'zustand';
import { queryService } from '../services/query';
import { getErrorMessage, normalizeQueryResponse } from '@/lib/runtime-safety';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sourceFiles?: string[];
  retrievedChunks?: number;
}

interface ChatState {
  messages: ChatMessage[];
  isLoading: boolean;
  error: string | null;
  sendMessage: (question: string) => Promise<void>;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isLoading: false,
  error: null,

  sendMessage: async (question: string) => {
    if (!question.trim()) return;

    const userMessage: ChatMessage = {
      id: Math.random().toString(36).substring(7),
      role: 'user',
      content: question,
      timestamp: new Date(),
    };

    set((state) => ({
      messages: [...state.messages, userMessage],
      isLoading: true,
      error: null,
    }));

    try {
      const response = normalizeQueryResponse(await queryService.queryRepository(question));
      const assistantMessage: ChatMessage = {
        id: Math.random().toString(36).substring(7),
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
        sourceFiles: response.source_files,
        retrievedChunks: response.retrieved_chunks,
      };

      set((state) => ({
        messages: [...state.messages, assistantMessage],
        isLoading: false,
      }));
    } catch (err: unknown) {
      set({
        isLoading: false,
        error: getErrorMessage(err, 'Failed to get answer from assistant'),
      });
    }
  },

  clearChat: () => set({ messages: [], isLoading: false, error: null }),
}));
