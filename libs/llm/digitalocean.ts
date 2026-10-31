import "server-only";
import { ProviderError, type ProviderCall } from "./types";

const DEFAULT_HOST = "https://inference.do-ai.run";

interface OpenAiChatResponse {
  readonly model?: unknown;
  readonly choices?: ReadonlyArray<{ readonly message?: { readonly content?: unknown }; readonly finish_reason?: unknown }>;
  readonly usage?: { readonly prompt_tokens?: unknown; readonly completion_tokens?: unknown };
}

const asNumber = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : undefined);
const asString = (value: unknown) => (typeof value === "string" && value ? value : undefined);

/**
 * DigitalOcean Gradient serverless inference: open-weight models (Gemma 4,
 * gpt-oss, Llama...) behind an OpenAI-compatible chat completions API.
 */
export const callDigitalOcean: ProviderCall = async (model, messages, options, timeoutMs) => {
  const host = (process.env.DIGITALOCEAN_INFERENCE_HOST || DEFAULT_HOST).replace(/\/$/, "");
  const response = await fetch(`${host}/v1/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.DIGITALOCEAN_INFERENCE_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      temperature: Math.min(1, options.temperature),
      max_completion_tokens: options.maxTokens,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new ProviderError(`http_${response.status}`);
  const data = (await response.json()) as OpenAiChatResponse;
  const choice = data.choices?.[0];
  const content = choice?.message?.content;
  return {
    text: typeof content === "string" && content.trim() ? content : null,
    responseModel: asString(data.model) ?? model,
    inputTokens: asNumber(data.usage?.prompt_tokens),
    outputTokens: asNumber(data.usage?.completion_tokens),
    finishReason: asString(choice?.finish_reason),
  };
};
