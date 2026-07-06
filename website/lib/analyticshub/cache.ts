/**
 * 6-hour result cache in the config store. Keyed by source + range so the daily
 * check is instant and we don't hammer provider APIs. Only successful envelopes
 * are cached (never an error/reconnect state); `refresh=1` bypasses the read and
 * connect/disconnect busts a source's whole cache.
 */
import { delByPrefix, getRaw, setRaw } from "./store";
import type { DateRange } from "./dates";
import type { SourceKey, SourceResult } from "./types";

const TTL_SECONDS = 6 * 60 * 60;

function cacheKey(source: SourceKey, range: DateRange): string {
  return `cache:${source}:${range.from}:${range.to}`;
}

export async function readCache(
  source: SourceKey,
  range: DateRange,
): Promise<SourceResult | null> {
  const raw = await getRaw(cacheKey(source, range));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as SourceResult;
    return { ...parsed, cached: true };
  } catch {
    return null;
  }
}

export async function writeCache(
  source: SourceKey,
  range: DateRange,
  result: SourceResult,
): Promise<void> {
  if (result.status !== "ok") return; // cache successes only
  await setRaw(cacheKey(source, range), JSON.stringify(result), TTL_SECONDS);
}

/** Drop every cached range for a source (call on connect/disconnect). */
export async function bustSource(source: SourceKey): Promise<void> {
  await delByPrefix(`cache:${source}:`);
}
