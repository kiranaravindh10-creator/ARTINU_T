import { api } from '@/lib/api';

export interface AssistantTurn {
  role: 'user' | 'assistant';
  content: string;
}

export interface AssistantReply {
  answer: string;
  suggestions: string[];
  sources: { title: string }[];
}

/**
 * The browser's only route to the assistant.
 *
 * Retrieval, the prompt and the model key all live on the server; this sends a
 * question and receives prose. Nothing about how the answer was assembled —
 * chunks, scores, the system prompt — is ever in the browser.
 */
export const assistantService = {
  async config() {
    const { data } = await api.get<{ available: boolean; starters: string[] }>('/assistant');
    return data;
  },

  async ask(message: string, conversation: AssistantTurn[]) {
    const { data } = await api.post<AssistantReply>('/assistant', {
      message,
      // Bounded to match the server's own cap, so a long session cannot be
      // rejected wholesale for carrying too much history.
      conversation: conversation.slice(-10),
    });
    return data;
  },
};
