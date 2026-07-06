/**
 * Data handlers — `GET data/<source>` and `GET data/all`. Each source is fetched
 * independently: connection preconditions short-circuit to not_connected /
 * reconnect_needed without a network call, successes are cached 6h, and a fetch
 * failure funnels into that source's own envelope (reconnect flips the sticky
 * flag) so one dead token never touches another source.
 */
import { readCache, writeCache } from "../cache";
import * as config from "../config";
import { safeRange, type DateRange } from "../dates";
import { isDbConfigured } from "../env";
import { SOURCE_ORDER } from "../metrics";
import { cryptoReady } from "../crypto";
import { toProviderFailure } from "../providers/errors";
import { fetchGa4 } from "../providers/ga4";
import { fetchGads } from "../providers/gads";
import { fetchGsc } from "../providers/gsc";
import { fetchMeta } from "../providers/meta";
import { getGoogleAccessToken } from "../providers/google-token";
import { fetchUsers } from "../providers/users";
import type { AllData, SourceKey, SourceResult, SourceStatus } from "../types";
import { json } from "./respond";

function envelope(source: SourceKey, status: SourceStatus, error?: string): SourceResult {
  return { source, status, series: [], totals: {}, previous: {}, error };
}

const RECONNECT_MSG =
  "This connection was revoked or expired. Reconnect it in settings.";

/**
 * Connection preconditions. Returns a short-circuit envelope (not_connected /
 * reconnect_needed / error) when we shouldn't attempt a fetch, else null.
 */
async function precheck(source: SourceKey): Promise<SourceResult | null> {
  if (source === "users") {
    return isDbConfigured()
      ? null
      : envelope(
          "users",
          "error",
          "MONGODB_URI is not set. Reuse the backend cluster; add it to website/.env.local.",
        );
  }

  if (!cryptoReady()) {
    // Without the encryption key we can't read any stored credential.
    return envelope(source, "not_connected");
  }

  if (source === "ga4" || source === "gsc") {
    const sel = await config.getGoogleSelection();
    const connected =
      (await config.isGoogleConnected()) &&
      (source === "ga4" ? Boolean(sel.propertyId) : Boolean(sel.siteUrl));
    if (!connected) return envelope(source, "not_connected");
    if (await config.needsReconnect(source)) {
      return envelope(source, "reconnect_needed", RECONNECT_MSG);
    }
    return null;
  }

  if (source === "meta") {
    if (!(await config.isMetaConnected())) return envelope("meta", "not_connected");
    if (await config.needsReconnect("meta")) {
      return envelope("meta", "reconnect_needed", RECONNECT_MSG);
    }
    return null;
  }

  // gads
  if (!(await config.isGadsConnected())) return envelope("gads", "not_connected");
  if (await config.needsReconnect("gads")) {
    return envelope("gads", "reconnect_needed", RECONNECT_MSG);
  }
  return null;
}

async function runFetch(source: SourceKey, range: DateRange): Promise<SourceResult> {
  switch (source) {
    case "users":
      return fetchUsers(range);
    case "ga4": {
      const [token, sel] = await Promise.all([
        getGoogleAccessToken(),
        config.getGoogleSelection(),
      ]);
      return fetchGa4(token, sel.propertyId as string, range);
    }
    case "gsc": {
      const [token, sel] = await Promise.all([
        getGoogleAccessToken(),
        config.getGoogleSelection(),
      ]);
      return fetchGsc(token, sel.siteUrl as string, range);
    }
    case "meta": {
      const [creds, sel] = await Promise.all([config.getMetaCreds(), config.getMetaSelection()]);
      return fetchMeta((creds as { token: string }).token, sel.accountId as string, range);
    }
    case "gads": {
      const creds = await config.getGadsCreds();
      return fetchGads(creds as NonNullable<typeof creds>, range);
    }
    default:
      return envelope(source, "not_connected");
  }
}

export async function getSourceData(
  source: SourceKey,
  range: DateRange,
  refresh: boolean,
): Promise<SourceResult> {
  const pre = await precheck(source);
  if (pre) return pre;

  if (!refresh) {
    const cached = await readCache(source, range);
    if (cached) return cached;
  }

  try {
    const result = await runFetch(source, range);
    result.fetchedAt = new Date().toISOString();
    await writeCache(source, range, result);
    return result;
  } catch (err) {
    const { message, reconnect } = toProviderFailure(err);
    if (reconnect) await config.markReconnect(source);
    return envelope(source, reconnect ? "reconnect_needed" : "error", message);
  }
}

function isSourceKey(value: string): value is SourceKey {
  return (SOURCE_ORDER as readonly string[]).includes(value);
}

export async function handleData(source: string, req: Request): Promise<Response> {
  const url = new URL(req.url);
  const range = safeRange(url.searchParams.get("from"), url.searchParams.get("to"));
  const refresh = url.searchParams.get("refresh") === "1";

  if (source === "all") {
    const settled = await Promise.allSettled(
      SOURCE_ORDER.map((s) => getSourceData(s, range, refresh)),
    );
    const out: AllData = {};
    SOURCE_ORDER.forEach((s, i) => {
      const r = settled[i];
      out[s] =
        r.status === "fulfilled"
          ? r.value
          : envelope(s, "error", toProviderFailure(r.reason).message);
    });
    return json({ range, sources: out });
  }

  if (!isSourceKey(source)) return json({ error: "Unknown source." }, 404);
  return json({ range, source: await getSourceData(source, range, refresh) });
}
