import type { SupabaseClient } from "@supabase/supabase-js";

export const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export type RateLimitScope = "anon" | "user";

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
};

export type RateLimitConfig = {
  anon: number;
  user: number;
};

function positiveIntFromEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

export function getRateLimitConfig(): RateLimitConfig {
  return {
    anon: positiveIntFromEnv("RATE_LIMIT_ANON_PER_HOUR", 5),
    user: positiveIntFromEnv("RATE_LIMIT_USER_PER_HOUR", 30),
  };
}

export function getClientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  return headers.get("x-real-ip")?.trim() || "unknown";
}

export function rateLimitKey(scope: RateLimitScope, id: string): string {
  return `${scope}:${id}`;
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
  };
}

type Bucket = { count: number; resetAt: number };

export function createMemoryRateLimiter(now: () => number = Date.now) {
  const buckets = new Map<string, Bucket>();

  function prune(currentTime: number) {
    if (buckets.size < 5_000) return;
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= currentTime) buckets.delete(key);
    }
  }

  return {
    consume(key: string, limit: number, windowMs: number = RATE_LIMIT_WINDOW_MS): RateLimitResult {
      const currentTime = now();
      prune(currentTime);

      const existing = buckets.get(key);
      const bucket =
        existing && existing.resetAt > currentTime
          ? existing
          : { count: 0, resetAt: currentTime + windowMs };

      bucket.count += 1;
      buckets.set(key, bucket);

      return {
        allowed: bucket.count <= limit,
        limit,
        remaining: Math.max(0, limit - bucket.count),
        resetAt: bucket.resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - currentTime) / 1000)),
      };
    },
  };
}

const memoryLimiter = createMemoryRateLimiter();
let warnedAboutMemoryLimiter = false;

function warnAboutMemoryLimiter() {
  if (warnedAboutMemoryLimiter) return;
  warnedAboutMemoryLimiter = true;
  console.warn(
    "[rate-limit] Supabase is not configured, so an in-memory limiter is in use. " +
      "Counts live on a single server instance and reset on redeploy, so this is not suitable for production.",
  );
}

/**
 * Atomically records a hit and reports whether it is still within the limit.
 * Uses Supabase when a client is provided so counts survive across serverless
 * instances, and falls back to an in-memory map for local development.
 */
export async function consumeRateLimit(options: {
  key: string;
  limit: number;
  supabase?: SupabaseClient | null;
}): Promise<RateLimitResult> {
  const { key, limit, supabase } = options;

  if (!supabase) {
    warnAboutMemoryLimiter();
    return memoryLimiter.consume(key, limit);
  }

  try {
    const { data, error } = await supabase.rpc("consume_rate_limit", {
      p_key: key,
      p_limit: limit,
      p_window_seconds: Math.floor(RATE_LIMIT_WINDOW_MS / 1000),
    });

    if (error) throw error;

    const row = (Array.isArray(data) ? data[0] : data) as
      | { allowed?: boolean; current_count?: number; reset_at?: string }
      | null
      | undefined;

    if (row) {
      const currentCount = Number(row.current_count) || 0;
      const resetAt = row.reset_at
        ? new Date(row.reset_at).getTime()
        : Date.now() + RATE_LIMIT_WINDOW_MS;

      return {
        allowed: Boolean(row.allowed),
        limit,
        remaining: Math.max(0, limit - currentCount),
        resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)),
      };
    }
  } catch (error) {
    // Fail open so a database hiccup never takes generation down entirely.
    console.error("[rate-limit] Supabase limiter failed; allowing the request:", error);
    return {
      allowed: true,
      limit,
      remaining: limit,
      resetAt: Date.now() + RATE_LIMIT_WINDOW_MS,
      retryAfterSeconds: 0,
    };
  }

  warnAboutMemoryLimiter();
  return memoryLimiter.consume(key, limit);
}
