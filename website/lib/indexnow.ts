import { after } from "next/server";

import { connectDb, isDbConfigured } from "@/lib/blog/db";
import { readSiteSettings } from "@/lib/content/get";
import { PageMetaModel } from "@/lib/content/models";
import { siteConfig } from "@/lib/site";

/**
 * IndexNow — tell Bing, Yandex, Naver, Seznam and Yep the moment a URL is
 * published, changed, or removed, instead of waiting for the next crawl.
 *
 * Bing is the point of it. It is a primary retrieval layer for ChatGPT Search,
 * so a post that Bing hasn't re-crawled is a post that doesn't exist to a large
 * slice of AI search. (Google does not participate — its own discovery is
 * unaffected by any of this, and `app/sitemap.ts` is still what feeds it.)
 *
 * Three rules hold this together:
 *
 *   1. **It is a hint, never a step.** Every call is fire-and-forget: it returns
 *      `void`, it never throws, and it never delays or fails the save that
 *      triggered it. A search engine that doesn't hear about a URL is a slower
 *      crawl; a save that 500s because of a search engine is a bug.
 *   2. **Production only.** A ping from a preview deploy would submit URLs the
 *      key file doesn't back (422) or, worse, advertise a staging build. No key
 *      or `VERCEL_ENV !== "production"` → silent no-op.
 *   3. **The same URLs the sitemap advertises.** Exclusions are re-derived from
 *      `PageMeta` here rather than guessed at the call site, so a page the
 *      sitemap drops is a page IndexNow never submits.
 *
 * Setup is one manual step, documented in README.md: generate a key at
 * bing.com/webmasters → IndexNow, commit `public/<key>.txt` containing that key,
 * and set `INDEXNOW_KEY` to it.
 */

const ENDPOINT = "https://api.indexnow.org/indexnow";

/** The protocol's per-request ceiling. */
const MAX_URLS_PER_REQUEST = 10_000;

/**
 * First path segments that must never be submitted: the authenticated `(app)`
 * routes, the two private dashboards, and the API surface. These are not in
 * `app/sitemap.ts` either — they're behind a login and a `noindex`, and pinging
 * one only tells a crawler where the front door is.
 *
 * Deliberately not `RESERVED_SLUGS`: that list also holds `/blog` and the eight
 * keyword pages, which are exactly what we *do* want submitted.
 */
const PRIVATE_SEGMENTS = new Set([
  "dashboard",
  "people",
  "reminders",
  "calendar",
  "lists",
  "settings",
  "import",
  "invite",
  "welcome",
  "auth",
  "login",
  "signup",
  "seoteam",
  "analyticshub",
  "api",
]);

/**
 * Generated files. Callers reach for these by reflex — the admin routes all
 * `revalidatePath("/sitemap.xml")` — but IndexNow submits content URLs, not
 * discovery documents.
 */
const NON_PAGE_PATHS = new Set([
  "/sitemap.xml",
  "/robots.txt",
  "/llms.txt",
  "/manifest.webmanifest",
  "/manifest.json",
  "/favicon.ico",
]);

export interface PingIndexNowOptions {
  /**
   * Submit even when the page is `noindex` or `sitemap.exclude`.
   *
   * For the one case where the exclusion is the *news*: a page just flipped to
   * noindex still wants a crawl, because that's how the engine learns to drop
   * it. It does not bypass the sitewide indexing kill-switch — when the whole
   * site is marked unindexable, nothing is submitted, full stop.
   */
  force?: boolean;
  /**
   * Lift the production-only guard.
   *
   * Only `scripts/indexnow-ping.ts` passes this, and only because it *is* the
   * deliberate manual submission — it runs from a laptop or from CI, where
   * `VERCEL_ENV` is never "production", but the URLs it submits are the live
   * ones. Nothing in the request path may set it.
   */
  allowNonProduction?: boolean;
}

/** The site's host, e.g. `birthdayreminders.us`. Empty if the origin is junk. */
function siteHost(): string {
  try {
    return new URL(siteConfig.url).host;
  } catch {
    return "";
  }
}

/**
 * Absolute URL for a path, byte-identical to what `app/sitemap.ts` emits — the
 * two lists have to agree, or IndexNow submits URLs the sitemap denies.
 *
 * Accepts a path (`/blog/foo`) or an already-absolute URL, and returns `null`
 * for anything off-host, non-http, or not a page.
 */
function toAbsoluteUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // A path with whitespace in it is not a path — it's a caller mistake, and
  // submitting it would waste a slot and look like nonsense in Bing's report.
  if (/\s/.test(trimmed)) return null;

  let path: string;
  if (/^https?:\/\//i.test(trimmed)) {
    let parsed: URL;
    try {
      parsed = new URL(trimmed);
    } catch {
      return null;
    }
    // Another host's URL is a 422 waiting to happen — the key only proves
    // ownership of ours.
    if (parsed.host !== siteHost()) return null;
    path = parsed.pathname;
  } else if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith("//")) {
    // `mailto:`, `ftp://`, `//cdn.example/x` — anything with a scheme that
    // isn't ours. Falling through would turn it into the path `/ftp://…`.
    return null;
  } else {
    path = trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
  }

  // Query strings and fragments are not distinct documents here.
  path = path.split(/[?#]/)[0];
  // `/blog/` and `/blog` are one URL; the sitemap emits the unslashed form.
  if (path.length > 1) path = path.replace(/\/+$/, "");
  if (NON_PAGE_PATHS.has(path)) return null;

  const first = path.split("/")[1] ?? "";
  if (PRIVATE_SEGMENTS.has(first)) return null;

  return `${siteConfig.url}${path === "/" ? "" : path}`;
}

/** `https://<host>/<key>.txt` — where the engine verifies the key. */
function keyLocationFor(key: string): string {
  return `${siteConfig.url}/${key}.txt`;
}

/**
 * Drop URLs the sitemap wouldn't carry.
 *
 * Read uncached and by hand rather than through `getAllPageMeta()`: this runs
 * *after* the write that triggered it, and that getter is React-`cache()`d, so
 * it would replay the pre-save value — the same trap `readSiteSettings` exists
 * to avoid. On any database trouble the URLs pass through: a missed exclusion
 * costs one wasted crawl, a swallowed publish costs the whole point of this.
 */
async function withoutExcluded(urls: string[]): Promise<string[]> {
  if (!isDbConfigured()) return urls;

  const paths = urls.map((url) => {
    const path = new URL(url).pathname;
    return path === "" ? "/" : path;
  });

  try {
    await connectDb();
    const docs = await PageMetaModel.find({ path: { $in: paths } })
      .select("path noindex sitemap")
      .lean();

    const blocked = new Set<string>();
    for (const doc of docs as unknown as {
      path: string;
      noindex?: boolean;
      sitemap?: { exclude?: boolean };
    }[]) {
      if (doc.noindex || doc.sitemap?.exclude) blocked.add(doc.path);
    }
    if (blocked.size === 0) return urls;

    return urls.filter((url, i) => !blocked.has(paths[i]));
  } catch {
    return urls;
  }
}

/** POST one chunk. Resolves either way; `false` means the engine refused it. */
async function submit(key: string, host: string, urlList: string[]): Promise<boolean> {
  let res: Response;
  try {
    res = await fetch(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key,
        keyLocation: keyLocationFor(key),
        urlList,
      }),
    });
  } catch (err) {
    console.error("IndexNow request failed:", err);
    return false;
  }

  if (res.status === 200 || res.status === 202) {
    console.log(`IndexNow: submitted ${urlList.length} URL(s) (${res.status}).`);
    return true;
  }

  // 403 = the key wasn't found or didn't match; 422 = the URLs don't belong to
  // the host, or the key file's contents disagree with the key. Both mean the
  // setup is broken and every ping from here on is being thrown away, so they
  // get the loud treatment rather than a quiet line in the noise.
  if (res.status === 403 || res.status === 422) {
    console.error(
      `IndexNow rejected the submission (${res.status}). The key file is wrong: ` +
        `${keyLocationFor(key)} must be reachable and contain exactly "${key}". ` +
        `Nothing is being indexed through IndexNow until that is fixed.`,
    );
    return false;
  }

  console.warn(`IndexNow returned ${res.status} for ${urlList.length} URL(s).`);
  return false;
}

/** What a submission actually did — for the CLI's exit code. Never thrown. */
export interface IndexNowResult {
  submitted: number;
  /** False when a request was rejected, or when the setup made it a no-op. */
  ok: boolean;
  /** Why nothing was submitted, when nothing was. */
  skipped?: "no-key" | "not-production" | "bad-site-url" | "no-urls" | "indexing-disabled";
}

/**
 * The awaitable core. `pingIndexNow` is the fire-and-forget wrapper every
 * publish path uses; this one exists for `scripts/indexnow-ping.ts`, which is a
 * foreground command and needs a real exit code.
 *
 * Resolves rather than rejects, always.
 */
export async function submitIndexNow(
  urls: string | string[],
  options: PingIndexNowOptions = {},
): Promise<IndexNowResult> {
  const key = process.env.INDEXNOW_KEY?.trim();
  if (!key) return { submitted: 0, ok: false, skipped: "no-key" };
  // Never from dev or a preview deploy: those URLs aren't ours to submit.
  if (!options.allowNonProduction && process.env.VERCEL_ENV !== "production") {
    return { submitted: 0, ok: true, skipped: "not-production" };
  }

  const host = siteHost();
  if (!host) return { submitted: 0, ok: false, skipped: "bad-site-url" };

  const list = Array.isArray(urls) ? urls : [urls];
  const absolute = new Set<string>();
  for (const entry of list) {
    const url = toAbsoluteUrl(entry);
    if (url) absolute.add(url);
  }
  if (absolute.size === 0) return { submitted: 0, ok: true, skipped: "no-urls" };

  try {
    // The danger-zone kill-switch, same as the sitemap's: an unindexable site
    // advertises nothing, and `force` does not override it.
    const settings = await readSiteSettings();
    if (!settings.seo.indexingEnabled) {
      return { submitted: 0, ok: true, skipped: "indexing-disabled" };
    }

    const eligible = options.force ? [...absolute] : await withoutExcluded([...absolute]);
    if (eligible.length === 0) return { submitted: 0, ok: true, skipped: "no-urls" };

    let ok = true;
    let submitted = 0;
    for (let i = 0; i < eligible.length; i += MAX_URLS_PER_REQUEST) {
      const chunk = eligible.slice(i, i + MAX_URLS_PER_REQUEST);
      // Counts what the engine actually accepted, not what we meant to send —
      // the CLI turns this into an exit code.
      if (await submit(key, host, chunk)) submitted += chunk.length;
      else ok = false;
    }
    return { submitted, ok };
  } catch (err) {
    // Belt and braces. Nothing above is meant to reject, but this can run
    // detached from a request, where an unhandled rejection takes the process
    // with it.
    console.error("IndexNow ping failed:", err);
    return { submitted: 0, ok: false };
  }
}

/**
 * Tell the IndexNow engines that these URLs changed.
 *
 * Takes paths (`/blog/my-post`) or absolute URLs, in any mix. Returns
 * immediately — the work is handed to `after()` inside a request, so the
 * platform keeps the function alive past the response, and to a floating
 * promise outside one.
 */
export function pingIndexNow(
  urls: string | string[],
  options: PingIndexNowOptions = {},
): void {
  const run = () => submitIndexNow(urls, options);
  try {
    after(run);
  } catch {
    // Outside a request scope (scripts, tests) `after` throws — run it detached.
    void run();
  }
}

/** Exported for tests; not part of the publish path. */
export const __internal = { toAbsoluteUrl, keyLocationFor, MAX_URLS_PER_REQUEST };
