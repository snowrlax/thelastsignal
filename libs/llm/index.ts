import "server-only";
import { callDigitalOcean } from "./digitalocean";
import { callOllama } from "./ollama";
import {
  ProviderError,
  type ChatAttempt,
  type ChatMessage,
  type ChatOptions,
  type ChatResult,
  type ModelTarget,
  type ProviderCall,
  type ProviderName,
  type ResolvedChatOptions,
} from "./types";

export type { ChatAttempt, ChatOptions, ChatResult, ModelTarget, ProviderName } from "./types";

const DEFAULT_OLLAMA_MODEL = "gemma4:31b";
const DEFAULT_OLLAMA_FALLBACK_MODEL = "gpt-oss:20b";
const DEFAULT_DIGITALOCEAN_MODEL = "gemma-4-31B-it";
/** Below this, another attempt cannot finish in time. */
const MIN_ATTEMPT_MS = 600;
/** Any attempt but the last gets at most this much, so a hung provider leaves time for the next. */
const MAX_EARLY_ATTEMPT_MS = 2_500;

const PROVIDERS: Record<ProviderName, ProviderCall> = {
  ollama: callOllama,
  digitalocean: callDigitalOcean,
};

function ollamaTargets(): ModelTarget[] {
  if (!process.env.OLLAMA_API_KEY) return [];
  const primary = process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL;
  const fallback = process.env.OLLAMA_FALLBACK_MODEL || DEFAULT_OLLAMA_FALLBACK_MODEL;
  const models = primary === fallback ? [primary] : [primary, fallback];
  return models.map((model) => ({ provider: "ollama", model }));
}

function digitalOceanTargets(): ModelTarget[] {
  if (!process.env.DIGITALOCEAN_INFERENCE_KEY) return [];
  return [{ provider: "digitalocean", model: process.env.DIGITALOCEAN_MODEL || DEFAULT_DIGITALOCEAN_MODEL }];
}

/**
 * The order models are tried in. By default: Gemma on Ollama Cloud, the same
 * open weights on DigitalOcean, then a different open model (gpt-oss) on
 * Ollama. DIALOGUE_PRIMARY_PROVIDER=digitalocean puts DigitalOcean first.
 * Providers without a key are skipped.
 */
export function configuredTargets(): ModelTarget[] {
  const [ollamaPrimary, ...ollamaRest] = ollamaTargets();
  const digitalOcean = digitalOceanTargets();
  const ordered =
    process.env.DIALOGUE_PRIMARY_PROVIDER === "digitalocean"
      ? [...digitalOcean, ollamaPrimary, ...ollamaRest]
      : [ollamaPrimary, ...digitalOcean, ...ollamaRest];
  return ordered.filter((target): target is ModelTarget => target !== undefined);
}

function failureCode(error: unknown): string {
  if (error instanceof ProviderError) return error.code;
  if (error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")) return "timeout";
  return "network";
}

/** Wraps a single provider call; lets tracing observe every attempt. */
export type AttemptRunner = (target: ModelTarget, run: () => Promise<ChatAttempt>) => Promise<ChatAttempt>;

const untraced: AttemptRunner = (_target, run) => run();

async function attempt(target: ModelTarget, messages: readonly ChatMessage[], options: ResolvedChatOptions, timeoutMs: number): Promise<ChatAttempt> {
  const started = Date.now();
  try {
    const reply = await PROVIDERS[target.provider](target.model, messages, options, timeoutMs);
    return { target, reply, durationMs: Date.now() - started, error: reply.text ? null : "empty" };
  } catch (error) {
    const code = failureCode(error);
    console.error(`[llm] ${target.provider}:${target.model} failed: ${code}`);
    return { target, reply: null, durationMs: Date.now() - started, error: code };
  }
}

/**
 * Asks the open-weight models for one line of dialogue, trying each
 * configured target in turn within one time budget. Never throws: if every
 * target fails, `text` is null and the game uses its authored line.
 */
export async function generateLine(messages: readonly ChatMessage[], options: ChatOptions = {}, runAttempt: AttemptRunner = untraced): Promise<ChatResult> {
  const resolved: ResolvedChatOptions = {
    deadlineMs: options.deadlineMs ?? 4_500,
    maxTokens: options.maxTokens ?? 160,
    temperature: options.temperature ?? 0.85,
  };
  const targets = configuredTargets();
  const deadline = Date.now() + resolved.deadlineMs;
  const attempts: ChatAttempt[] = [];
  for (const [index, target] of targets.entries()) {
    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) break;
    const isLast = index === targets.length - 1;
    const timeoutMs = isLast ? remaining : Math.min(remaining, MAX_EARLY_ATTEMPT_MS);
    const result = await runAttempt(target, () => attempt(target, messages, resolved, timeoutMs));
    attempts.push(result);
    if (result.reply?.text) return { text: result.reply.text, target, attempts };
  }
  return { text: null, target: null, attempts };
}

/** Convenience wrapper when only the text matters. */
export async function chatCompletion(messages: readonly ChatMessage[], options: ChatOptions = {}): Promise<string | null> {
  return (await generateLine(messages, options)).text;
}
