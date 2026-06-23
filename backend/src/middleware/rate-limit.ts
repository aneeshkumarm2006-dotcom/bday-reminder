import type { Request, RequestHandler } from 'express';

import { tooManyRequests } from '../lib/http-error';

/**
 * In-memory fixed-window rate limiter (TODO Stage 12). Hand-rolled to match this
 * codebase's no-extra-dependency style (push/email/cloudinary all call REST
 * directly). Two instances are wired in `app.ts`: a strict one on the credential
 * endpoints (brute-force / credential-stuffing / email-enumeration defense) and
 * a lenient global one (flood ceiling). It emits standard `RateLimit-*` headers
 * and a `Retry-After`, and forwards a 429 HttpError to the central handler so
 * the body matches every other error response.
 *
 * Single-process only — fine for the free-tier single instance this app targets.
 * A multi-instance deploy would swap the Map for a shared store (Redis); the
 * middleware shape stays the same.
 */

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Window length in ms. */
  windowMs: number;
  /** Max requests allowed per key per window. */
  max: number;
  /** §10-voice message for the 429. */
  message?: string;
  /** Derive the bucket key (default: client IP). */
  keyGenerator?: (req: Request) => string;
}

/** Default key: the client IP (accurate once `trust proxy` is set in app.ts). */
function ipKey(req: Request): string {
  return req.ip ?? req.socket.remoteAddress ?? 'unknown';
}

export function rateLimit(opts: RateLimitOptions): RequestHandler {
  const {
    windowMs,
    max,
    message = 'Too many requests. Please wait a moment and try again.',
    keyGenerator = ipKey,
  } = opts;
  const buckets = new Map<string, Bucket>();

  return (req, res, next) => {
    const now = Date.now();
    const key = keyGenerator(req);

    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      bucket = { count: 0, resetAt: now + windowMs };
      buckets.set(key, bucket);
    }
    bucket.count += 1;

    // Bound memory: first reclaim expired buckets; if a high-cardinality flood
    // keeps the map above a hard ceiling with nothing expired, evict oldest-first
    // (Map preserves insertion order) so it can't grow without limit.
    if (buckets.size > 10_000) {
      for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
      const HARD_CAP = 50_000;
      if (buckets.size > HARD_CAP) {
        const overflow = buckets.size - HARD_CAP;
        let removed = 0;
        for (const k of buckets.keys()) {
          if (removed >= overflow || k === key) continue;
          buckets.delete(k);
          removed += 1;
        }
      }
    }

    const resetSeconds = Math.ceil((bucket.resetAt - now) / 1000);
    res.setHeader('RateLimit-Limit', String(max));
    res.setHeader('RateLimit-Remaining', String(Math.max(0, max - bucket.count)));
    res.setHeader('RateLimit-Reset', String(resetSeconds));

    if (bucket.count > max) {
      res.setHeader('Retry-After', String(resetSeconds));
      next(tooManyRequests(message));
      return;
    }
    next();
  };
}
