/**
 * Bounded retry with exponential backoff + full jitter (TODO Stage 12). Used by
 * the push and email channels so a transient provider blip (network error, 429,
 * or 5xx) doesn't permanently drop a reminder, while a permanent client error
 * (4xx) fails fast without wasting attempts. Retries stay INSIDE the provider so
 * the dispatch loop still sees a single result per channel and is never blocked
 * for more than a few seconds.
 *
 * A caller signals "retry me" by throwing `TransientError`; any other throw (or
 * a returned value) ends the loop immediately.
 */

/** Throw this to request a retry; carries an optional server-suggested delay. */
export class TransientError extends Error {
  retryAfterMs?: number;
  constructor(message: string, retryAfterMs?: number) {
    super(message);
    this.name = 'TransientError';
    this.retryAfterMs = retryAfterMs;
  }
}

export interface RetryOptions {
  /** Total attempts including the first (default 3). */
  attempts?: number;
  /** Base backoff in ms; doubles each attempt (default 500). */
  baseMs?: number;
  /** Backoff ceiling in ms (default 8000). */
  maxMs?: number;
  /** Called before each retry sleep - for logging. */
  onRetry?: (err: TransientError, attempt: number, delayMs: number) => void;
  /** Injectable sleep so tests run instantly. */
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run `fn`, retrying only when it throws `TransientError`, up to `attempts`
 * times. The delay is `min(maxMs, base * 2^(n-1))` with full jitter, unless the
 * error carries a `retryAfterMs` (e.g. an HTTP `Retry-After`), which wins.
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions = {},
): Promise<T> {
  const attempts = opts.attempts ?? 3;
  const baseMs = opts.baseMs ?? 500;
  const maxMs = opts.maxMs ?? 8000;
  const sleep = opts.sleep ?? defaultSleep;

  let lastErr: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn(attempt);
    } catch (err) {
      lastErr = err;
      if (!(err instanceof TransientError) || attempt === attempts) throw err;
      const expo = Math.min(maxMs, baseMs * 2 ** (attempt - 1));
      const jittered = Math.random() * expo; // full jitter spreads retries out
      const delay = err.retryAfterMs != null ? Math.min(maxMs, err.retryAfterMs) : jittered;
      opts.onRetry?.(err, attempt, delay);
      await sleep(delay);
    }
  }
  throw lastErr;
}

/** True for HTTP statuses worth retrying (timeout, rate-limit, server errors). */
export function isTransientStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

/** Parse a `Retry-After` header (seconds or HTTP-date) into ms, if present. */
export function retryAfterMs(headers: Headers): number | undefined {
  const value = headers.get('retry-after');
  if (!value) return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isNaN(date) ? undefined : Math.max(0, date - Date.now());
}
