export interface RateLimitResult {
  readonly allowed: boolean;
  readonly retryAfterMs: number;
}

export interface RateLimiter {
  check(key: string, now?: number): RateLimitResult;
}

/** Sliding-window limiter kept in memory. Good enough for a single game server. */
export function createRateLimiter(options: { limit: number; windowMs: number; maxKeys?: number }): RateLimiter {
  const hits = new Map<string, number[]>();
  const maxKeys = options.maxKeys ?? 10_000;

  return {
    check(key: string, now = Date.now()): RateLimitResult {
      const windowStart = now - options.windowMs;
      const recent = (hits.get(key) ?? []).filter((timestamp) => timestamp > windowStart);
      if (recent.length >= options.limit) {
        hits.set(key, recent);
        return { allowed: false, retryAfterMs: recent[0] + options.windowMs - now };
      }
      if (!hits.has(key) && hits.size >= maxKeys) {
        const oldest = hits.keys().next().value;
        if (oldest !== undefined) hits.delete(oldest);
      }
      hits.set(key, [...recent, now]);
      return { allowed: true, retryAfterMs: 0 };
    },
  };
}

/**
 * Client address as reported by the hosting proxy (x-real-ip is set by the
 * platform; x-forwarded-for is a fallback). Spoofable without a proxy, which is
 * why every route also has a global ceiling.
 */
export function clientKey(request: Request): string {
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return "local";
}

export const GLOBAL_KEY = "*";

/** Rejects bodies over the limit before they are parsed. */
export async function readLimitedJson(request: Request, maxBytes: number): Promise<{ ok: true; value: unknown } | { ok: false; status: 400 | 413 }> {
  const declared = Number(request.headers.get("content-length") ?? "0");
  if (declared > maxBytes) return { ok: false, status: 413 };
  const text = await request.text();
  if (text.length > maxBytes) return { ok: false, status: 413 };
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, status: 400 };
  }
}
