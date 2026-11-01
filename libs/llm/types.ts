import type { ChatMessage } from "@/game/story/prompts";

export type { ChatMessage };

/** Where an open-weight model is served from. */
export type ProviderName = "ollama" | "digitalocean";

export interface ModelTarget {
  readonly provider: ProviderName;
  readonly model: string;
}

export interface ChatOptions {
  /** Total time budget across all model attempts. */
  readonly deadlineMs?: number;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

export type ResolvedChatOptions = Required<ChatOptions>;

/** What one provider returned for one request. */
export interface ProviderReply {
  readonly text: string | null;
  readonly responseModel: string;
  readonly inputTokens?: number;
  readonly outputTokens?: number;
  readonly finishReason?: string;
}

export interface ChatAttempt {
  readonly target: ModelTarget;
  readonly durationMs: number;
  readonly reply: ProviderReply | null;
  /** Low-cardinality failure code ("http_402", "timeout", "empty"...). */
  readonly error: string | null;
}

export interface ChatResult {
  readonly text: string | null;
  /** The target that produced `text`, if any. */
  readonly target: ModelTarget | null;
  readonly attempts: readonly ChatAttempt[];
}

/** Thrown by providers with a short code that is safe to log and trace. */
export class ProviderError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = "ProviderError";
  }
}

export type ProviderCall = (model: string, messages: readonly ChatMessage[], options: ResolvedChatOptions, timeoutMs: number) => Promise<ProviderReply>;
