import { describe, expect, it, vi } from 'vitest';

import {
  isTransientStatus,
  retryAfterMs,
  TransientError,
  withRetry,
} from '../../src/lib/retry';

describe('retry: withRetry', () => {
  it('resolves on first success without sleeping', async () => {
    const sleep = vi.fn(async () => {});
    const result = await withRetry(async () => 'ok', { sleep });
    expect(result).toBe('ok');
    expect(sleep).not.toHaveBeenCalled();
  });

  it('retries a TransientError up to `attempts` then rethrows it', async () => {
    const sleep = vi.fn(async () => {});
    const boom = new TransientError('blip');
    const fn = vi.fn(async () => {
      throw boom;
    });

    await expect(withRetry(fn, { attempts: 3, sleep })).rejects.toBe(boom);
    // 3 attempts total → sleeps between them (attempts - 1).
    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);
  });

  it('rethrows a non-transient error immediately without retrying', async () => {
    const sleep = vi.fn(async () => {});
    const boom = new Error('permanent 400');
    const fn = vi.fn(async () => {
      throw boom;
    });

    await expect(withRetry(fn, { attempts: 3, sleep })).rejects.toBe(boom);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it('honors err.retryAfterMs: delay is min(maxMs, retryAfterMs)', async () => {
    const sleep = vi.fn(async () => {});
    // retryAfterMs (1000) is under maxMs (5000) → use retryAfterMs as-is.
    const fn = vi
      .fn<(attempt: number) => Promise<string>>()
      .mockRejectedValueOnce(new TransientError('rate limited', 1000))
      .mockResolvedValueOnce('done');

    const result = await withRetry(fn, { attempts: 3, maxMs: 5000, sleep });
    expect(result).toBe('done');
    expect(sleep).toHaveBeenCalledTimes(1);
    expect(sleep).toHaveBeenCalledWith(1000);

    // retryAfterMs (9000) exceeds maxMs (5000) → clamped to maxMs.
    const sleep2 = vi.fn(async () => {});
    const fn2 = vi
      .fn<(attempt: number) => Promise<string>>()
      .mockRejectedValueOnce(new TransientError('rate limited', 9000))
      .mockResolvedValueOnce('done');

    const result2 = await withRetry(fn2, { attempts: 3, maxMs: 5000, sleep: sleep2 });
    expect(result2).toBe('done');
    expect(sleep2).toHaveBeenCalledWith(5000);
  });

  it('succeeds on a later attempt and returns the value', async () => {
    const sleep = vi.fn(async () => {});
    const fn = vi
      .fn<(attempt: number) => Promise<string>>()
      .mockRejectedValueOnce(new TransientError('one blip'))
      .mockResolvedValueOnce('eventual');

    const result = await withRetry(fn, { attempts: 3, sleep });
    expect(result).toBe('eventual');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(sleep).toHaveBeenCalledTimes(1);
  });

  it('uses exponential backoff with jitter, each delay clamped to [0, maxMs]', async () => {
    const delays: number[] = [];
    const sleep = vi.fn(async (ms: number) => {
      delays.push(ms);
    });
    const fn = vi.fn(async () => {
      throw new TransientError('always');
    });

    await expect(
      withRetry(fn, { attempts: 4, baseMs: 100, maxMs: 1000, sleep }),
    ).rejects.toBeInstanceOf(TransientError);

    // 4 attempts → 3 jittered sleeps; each within [0, min(maxMs, base*2^(n-1))].
    expect(delays).toHaveLength(3);
    const ceilings = [100, 200, 400]; // base * 2^(attempt-1), all < maxMs
    delays.forEach((d, i) => {
      expect(d).toBeGreaterThanOrEqual(0);
      expect(d).toBeLessThanOrEqual(Math.min(1000, ceilings[i]));
    });
  });
});

describe('retry: isTransientStatus', () => {
  it('is true for retryable statuses (408/429/500/503)', () => {
    expect(isTransientStatus(408)).toBe(true);
    expect(isTransientStatus(429)).toBe(true);
    expect(isTransientStatus(500)).toBe(true);
    expect(isTransientStatus(503)).toBe(true);
  });

  it('is false for permanent client statuses (400/401/404)', () => {
    expect(isTransientStatus(400)).toBe(false);
    expect(isTransientStatus(401)).toBe(false);
    expect(isTransientStatus(404)).toBe(false);
  });
});

describe('retry: retryAfterMs', () => {
  it('parses a numeric seconds header into ms', () => {
    const headers = new Headers({ 'retry-after': '2' });
    expect(retryAfterMs(headers)).toBe(2000);
  });

  it('returns undefined when the header is absent', () => {
    const headers = new Headers();
    expect(retryAfterMs(headers)).toBeUndefined();
  });

  it('parses an HTTP-date header into a positive ms delta', () => {
    const headers = new Headers({ 'retry-after': new Date(Date.now() + 5000).toUTCString() });
    const ms = retryAfterMs(headers);
    expect(ms).toBeGreaterThan(2000);
    expect(ms).toBeLessThanOrEqual(5000);
  });

  it('clamps a past HTTP-date to 0', () => {
    const headers = new Headers({ 'retry-after': new Date(Date.now() - 5000).toUTCString() });
    expect(retryAfterMs(headers)).toBe(0);
  });
});
