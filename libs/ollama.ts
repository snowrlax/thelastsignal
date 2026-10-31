import "server-only";
import type { ChatMessage } from "@/game/story/prompts";

export interface ChatOptions {
  /** Total time budget across all model attempts. */
  readonly deadlineMs?: number;
  readonly maxTokens?: number;
  readonly temperature?: number;
}

interface OllamaChatResponse {
  readonly message?: { readonly content?: unknown };
}

const DEFAULT_HOST = "https://ollama.com";
const DEFAULT_MODEL = "gemma4:31b";
const DEFAULT_FALLBACK_MODEL = "gpt-oss:20b";

export function configuredModels(): string[] {
  const primary = process.env.OLLAMA_MODEL || DEFAULT_MODEL;
  const fallback = process.env.OLLAMA_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;
  return primary === fallback ? [primary] : [primary, fallback];
}

async function callModel(model: string, messages: readonly ChatMessage[], options: Required<ChatOptions>, timeoutMs: number): Promise<string | null> {
  const host = (process.env.OLLAMA_HOST || DEFAULT_HOST).replace(/\/$/, "");
  const response = await fetch(`${host}/api/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OLLAMA_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      ...(model.startsWith("gpt-oss") ? { think: "low" } : {}),
      options: { temperature: options.temperature, num_predict: options.maxTokens },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    console.error(`[ollama] ${model} responded ${response.status}`);
    return null;
  }
  const data = (await response.json()) as OllamaChatResponse;
  const content = data.message?.content;
  return typeof content === "string" && content.trim() ? content : null;
}

/**
 * Asks the open-weight model for one line of dialogue. Never throws: any
 * failure returns null so the game falls back to authored lines.
 */
export async function chatCompletion(messages: readonly ChatMessage[], options: ChatOptions = {}): Promise<string | null> {
  if (!process.env.OLLAMA_API_KEY) return null;
  const resolved: Required<ChatOptions> = {
    deadlineMs: options.deadlineMs ?? 4_500,
    maxTokens: options.maxTokens ?? 160,
    temperature: options.temperature ?? 0.85,
  };
  const deadline = Date.now() + resolved.deadlineMs;
  for (const model of configuredModels()) {
    const remaining = deadline - Date.now();
    if (remaining < 600) break;
    try {
      const content = await callModel(model, messages, resolved, remaining);
      if (content) return content;
    } catch (error) {
      const reason = error instanceof Error ? error.name : "unknown";
      console.error(`[ollama] ${model} failed: ${reason}`);
    }
  }
  return null;
}
