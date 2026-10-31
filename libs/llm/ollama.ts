import "server-only";
import { ProviderError, type ProviderCall } from "./types";

const DEFAULT_HOST = "https://ollama.com";

interface OllamaChatResponse {
  readonly model?: unknown;
  readonly message?: { readonly content?: unknown };
  readonly prompt_eval_count?: unknown;
  readonly eval_count?: unknown;
  readonly done_reason?: unknown;
}

const asNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const asString = (value: unknown) => (typeof value === "string" && value ? value : undefined);

/** Ollama's native chat API: Ollama Cloud by default, or a local server via OLLAMA_HOST. */
export const callOllama: ProviderCall = async (model, messages, options, timeoutMs) => {
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
  if (!response.ok) throw new ProviderError(`http_${response.status}`);
  const data = (await response.json()) as OllamaChatResponse;
  const content = data.message?.content;
  return {
    text: typeof content === "string" && content.trim() ? content : null,
    responseModel: asString(data.model) ?? model,
    inputTokens: asNumber(data.prompt_eval_count),
    outputTokens: asNumber(data.eval_count),
    finishReason: asString(data.done_reason),
  };
};
