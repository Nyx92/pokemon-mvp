// src/lib/rateLimit.ts
//
// Minimal in-memory sliding-window rate limiter.
//
// STOPGAP ONLY: state lives in a plain `Map` in this process's memory. That's
// fine for a single-instance/dev deployment, but it is NOT consistent across
// multiple serverless/server instances (e.g. Vercel can and does run more
// than one instance of this app concurrently) — each instance has its own
// independent counters, so real production traffic can exceed the intended
// limit by roughly (number of live instances)x. Real production hardening
// needs a shared store (Upstash Redis or similar) so all instances see the
// same counters.
//
// No setInterval/background sweep is used to evict expired entries — that
// pattern doesn't fit a serverless environment (an instance can be frozen or
// recycled at any time, leaking the timer or never running it). Instead,
// expired windows are evicted lazily: each call checks whether the caller's
// existing window has expired and, if so, simply starts a fresh one.

interface Bucket {
  count: number;
  windowStart: number;
}

const buckets = new Map<string, Bucket>();

export interface RateLimitOptions {
  /** Max allowed calls within the window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

export interface RateLimitResult {
  allowed: boolean;
  /** Only set when `allowed` is false — ms until the current window resets. */
  retryAfterMs?: number;
}

/**
 * Checks and records one attempt for `key` against a sliding window of
 * `opts.windowMs` milliseconds, allowing at most `opts.limit` attempts per
 * window. Callers typically key by `ip`, `email`, or `ip:email` depending on
 * what identity is available and what's being protected.
 */
export function checkRateLimit(key: string, opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || now - existing.windowStart >= opts.windowMs) {
    // No bucket yet, or the previous window has fully expired — start fresh.
    buckets.set(key, { count: 1, windowStart: now });
    return { allowed: true };
  }

  if (existing.count >= opts.limit) {
    return { allowed: false, retryAfterMs: opts.windowMs - (now - existing.windowStart) };
  }

  existing.count += 1;
  return { allowed: true };
}

/**
 * Best-effort caller IP for per-IP rate-limit keys — reads the first hop off
 * `x-forwarded-for` (set by the platform's proxy; unset in local dev), or
 * "unknown" if absent. "unknown" collapses every such caller into one shared
 * bucket, which is an acceptable trade-off for a stopgap in-memory limiter.
 */
export function getClientIp(req: Request): string {
  const forwardedFor = req.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}
