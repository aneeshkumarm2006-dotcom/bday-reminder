/**
 * Submit URLs to IndexNow by hand.
 *
 * The publish paths in `/seoteam` ping on their own (see `lib/indexnow.ts`), so
 * this is the backfill tool, not the normal route: the first submission after
 * turning IndexNow on, a re-submission after a key-file fix, or a nudge for
 * marketing pages that shipped as code rather than through the admin.
 *
 *   npm run indexnow:ping -- /blog/my-post /birthday-calendar
 *   npm run indexnow:ping -- --all        # every URL in the sitemap
 *   npm run indexnow:ping -- --all --dry-run
 *
 * `--all` reads the *live* sitemap over HTTP rather than rebuilding it here —
 * the sitemap is a force-dynamic route backed by Mongo, and what production is
 * actually serving is the honest answer to "what should be indexed".
 *
 * Reads INDEXNOW_KEY (and optionally NEXT_PUBLIC_SITE_URL, MONGODB_URI) from the
 * environment or `website/.env.local`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const positional = args.filter((a) => !a.startsWith("--"));

const all = flags.has("--all");
const dryRun = flags.has("--dry-run");

/** Minimal .env.local reader, matching `scripts/seed-content.ts`. */
function loadEnvLocal(): void {
  try {
    const file = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of file.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, "");
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    /* no .env.local — the env vars may still be set another way */
  }
}

/** Every `<loc>` in a sitemap document. */
function parseSitemapLocs(xml: string): string[] {
  const out: string[] = [];
  for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)) {
    out.push(decodeXml(match[1]));
  }
  return out;
}

function decodeXml(value: string): string {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

async function fetchSitemapUrls(siteUrl: string): Promise<string[]> {
  const target = `${siteUrl}/sitemap.xml`;
  const res = await fetch(target, { headers: { "User-Agent": "indexnow-ping" } });
  if (!res.ok) {
    throw new Error(`GET ${target} returned ${res.status}`);
  }
  return parseSitemapLocs(await res.text());
}

async function main(): Promise<void> {
  loadEnvLocal();

  // Imported after the env file is loaded: the module reads `INDEXNOW_KEY` and
  // `siteConfig` at call time, but `lib/site.ts` resolves NEXT_PUBLIC_SITE_URL
  // when it is first evaluated.
  const { siteConfig } = await import("../lib/site");
  const { submitIndexNow } = await import("../lib/indexnow");

  if (!process.env.INDEXNOW_KEY?.trim()) {
    console.error(
      "INDEXNOW_KEY is not set. Generate a key at bing.com/webmasters → IndexNow,\n" +
        "commit public/<key>.txt containing it, then set INDEXNOW_KEY.",
    );
    process.exitCode = 1;
    return;
  }

  let urls: string[];
  if (all) {
    urls = await fetchSitemapUrls(siteConfig.url);
    console.log(`Read ${urls.length} URL(s) from ${siteConfig.url}/sitemap.xml`);
  } else if (positional.length > 0) {
    urls = positional;
  } else {
    console.error(
      "Usage: npm run indexnow:ping -- <url|path>...\n" +
        "       npm run indexnow:ping -- --all        submit every sitemap URL\n" +
        "       npm run indexnow:ping -- --dry-run    print, don't submit",
    );
    process.exitCode = 1;
    return;
  }

  if (urls.length === 0) {
    console.log("Nothing to submit.");
    return;
  }

  if (dryRun) {
    console.log(`Would submit ${urls.length} URL(s):`);
    for (const url of urls) console.log(`  ${url}`);
    return;
  }

  // `submitIndexNow` rather than `pingIndexNow`: this is a foreground command,
  // so it waits and reports instead of firing and forgetting.
  //
  // `allowNonProduction` because this *is* the deliberate manual submission — it
  // runs from a laptop or from CI, where VERCEL_ENV is never "production", but
  // the URLs are the live ones. `force` because a backfill submits what the
  // operator asked for, and `--all` already comes pre-filtered by the sitemap.
  const result = await submitIndexNow(urls, { allowNonProduction: true, force: true });

  if (result.skipped) {
    console.warn(`Nothing submitted (${result.skipped}).`);
  }
  if (!result.ok) {
    process.exitCode = 1;
    return;
  }
  console.log(`Done — ${result.submitted} URL(s) submitted.`);
}

/**
 * With MONGODB_URI set, the exclusion check opens a pooled connection and the
 * process would otherwise sit there with an open socket.
 */
async function closeDb(): Promise<void> {
  try {
    const mongoose = (await import("mongoose")).default;
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  } catch {
    /* nothing was open */
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(closeDb);
