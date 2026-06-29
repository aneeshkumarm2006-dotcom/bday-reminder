/**
 * In-memory rate limiter for the login endpoint. Two layers:
 *  1. Per-IP: lock a key out after a burst of failures.
 *  2. Global backstop: cap total failures across ALL keys in a window, so an
 *     attacker who rotates/spoofs IPs (X-Forwarded-For is client-controllable)
 *     still can't brute-force the single shared password without limit.
 *
 * Caveat: state is per-process — it resets on cold start and isn't shared across
 * serverless instances. It's a brute-force speed bump, not a distributed limiter;
 * front it with a platform/WAF limiter for production scale.
 */
interface Bucket {
  count: number;
  firstAt: number;
  lockedUntil: number;
}

const MAX_ATTEMPTS = 5; // per-IP attempts before lockout
const WINDOW_MS = 15 * 60 * 1000;
const LOCK_MS = 15 * 60 * 1000;
const MAX_BUCKETS = 5000; // crude memory cap

const GLOBAL_MAX = 50; // total failures across all IPs in a window
const GLOBAL_LOCK_MS = 15 * 60 * 1000;

const buckets = new Map<string, Bucket>();
const globalState = { count: 0, windowStart: 0, lockedUntil: 0 };

export interface RateLimitState {
  allowed: boolean;
  retryAfterSec: number;
}

export function checkRateLimit(key: string): RateLimitState {
  const now = Date.now();
  if (globalState.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((globalState.lockedUntil - now) / 1000),
    };
  }
  const bucket = buckets.get(key);
  if (bucket && bucket.lockedUntil > now) {
    return {
      allowed: false,
      retryAfterSec: Math.ceil((bucket.lockedUntil - now) / 1000),
    };
  }
  return { allowed: true, retryAfterSec: 0 };
}

export function recordFailure(key: string): void {
  const now = Date.now();

  // Evict the single oldest bucket instead of wiping every lockout on overflow.
  if (buckets.size >= MAX_BUCKETS && !buckets.has(key)) {
    let oldestKey: string | null = null;
    let oldestAt = Infinity;
    for (const [k, v] of buckets) {
      if (v.firstAt < oldestAt) {
        oldestAt = v.firstAt;
        oldestKey = k;
      }
    }
    if (oldestKey) buckets.delete(oldestKey);
  }

  let bucket = buckets.get(key);
  if (!bucket || now - bucket.firstAt > WINDOW_MS) {
    bucket = { count: 0, firstAt: now, lockedUntil: 0 };
  }
  bucket.count += 1;
  if (bucket.count >= MAX_ATTEMPTS) bucket.lockedUntil = now + LOCK_MS;
  buckets.set(key, bucket);

  // Global backstop.
  if (now - globalState.windowStart > WINDOW_MS) {
    globalState.count = 0;
    globalState.windowStart = now;
  }
  globalState.count += 1;
  if (globalState.count >= GLOBAL_MAX) {
    globalState.lockedUntil = now + GLOBAL_LOCK_MS;
  }
}

export function recordSuccess(key: string): void {
  buckets.delete(key);
  if (globalState.count > 0) globalState.count -= 1;
}
