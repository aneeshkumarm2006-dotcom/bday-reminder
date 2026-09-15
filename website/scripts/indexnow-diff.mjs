/**
 * Diff production's sitemap against the previous run's snapshot, and write the
 * URLs that moved to `changed-urls.txt`.
 *
 * Only `.github/workflows/indexnow.yml` runs this — it's the deploy-side half
 * of IndexNow, covering pages that ship as code and so never pass through a
 * `/seoteam` save. Plain `.mjs` with no imports beyond node: it runs before
 * `npm ci`, so it cannot depend on anything installed.
 *
 * A URL is "changed" when it is new, when its `<lastmod>` moved, or when it has
 * disappeared — a removed URL still has to be submitted, because fetching the
 * 404 is how an engine learns to drop it.
 *
 * Worth knowing: `app/sitemap.ts` stamps the static routes' `lastModified` with
 * the time of the fetch, so those always read as changed. That is the intended
 * outcome here rather than a bug to work around — this workflow only runs on
 * pushes that touched `website/`, which is exactly when a code-shipped page may
 * have new copy that nothing else would announce.
 *
 *   Env: SITE_URL (required), SNAPSHOT (default sitemap-snapshot.json),
 *        SUBMIT_ALL ("true" ignores the diff and submits everything).
 *   Out: changed-urls.txt, the refreshed snapshot, and `count` on $GITHUB_OUTPUT.
 */
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

const SITE_URL = (process.env.SITE_URL ?? "").replace(/\/+$/, "");
const SNAPSHOT = process.env.SNAPSHOT || "sitemap-snapshot.json";
const SUBMIT_ALL = process.env.SUBMIT_ALL === "true";
const OUT = "changed-urls.txt";

if (!SITE_URL) {
  console.error("SITE_URL is required.");
  process.exit(1);
}

/** `{ loc: lastmod }` for every `<url>` entry. Missing `<lastmod>` becomes "". */
function parseSitemap(xml) {
  const entries = {};
  for (const block of xml.matchAll(/<url\b[^>]*>([\s\S]*?)<\/url>/g)) {
    const body = block[1];
    const loc = body.match(/<loc>\s*([^<]+?)\s*<\/loc>/)?.[1];
    if (!loc) continue;
    const lastmod = body.match(/<lastmod>\s*([^<]+?)\s*<\/lastmod>/)?.[1] ?? "";
    entries[decodeXml(loc)] = decodeXml(lastmod);
  }
  return entries;
}

function decodeXml(value) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function readSnapshot() {
  try {
    const parsed = JSON.parse(readFileSync(SNAPSHOT, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch {
    // No cache hit — the first run after turning this on, or after a cache
    // eviction. Treated as "everything is new" below.
    return null;
  }
}

function setOutput(name, value) {
  if (process.env.GITHUB_OUTPUT) {
    appendFileSync(process.env.GITHUB_OUTPUT, `${name}=${value}\n`);
  }
}

const res = await fetch(`${SITE_URL}/sitemap.xml`, {
  headers: { "User-Agent": "indexnow-diff" },
});
if (!res.ok) {
  console.error(`GET ${SITE_URL}/sitemap.xml returned ${res.status}`);
  process.exit(1);
}

const current = parseSitemap(await res.text());
const locs = Object.keys(current);
if (locs.length === 0) {
  console.error("The sitemap listed no URLs — refusing to treat that as a diff.");
  process.exit(1);
}

const previous = readSnapshot();
let changed;

if (SUBMIT_ALL) {
  changed = locs;
  console.log(`--all: submitting all ${changed.length} sitemap URL(s).`);
} else if (!previous) {
  changed = locs;
  console.log(`No previous snapshot — submitting all ${changed.length} URL(s).`);
} else {
  const added = locs.filter((loc) => !(loc in previous));
  const updated = locs.filter((loc) => loc in previous && previous[loc] !== current[loc]);
  const removed = Object.keys(previous).filter((loc) => !(loc in current));
  changed = [...new Set([...added, ...updated, ...removed])];
  console.log(
    `${added.length} added, ${updated.length} updated, ${removed.length} removed.`,
  );
}

writeFileSync(OUT, changed.length > 0 ? `${changed.join("\n")}\n` : "", "utf8");
// The snapshot records what the sitemap says *now*, so a removed URL is
// submitted once and then forgotten rather than on every run forever.
writeFileSync(SNAPSHOT, `${JSON.stringify(current, null, 2)}\n`, "utf8");

setOutput("count", String(changed.length));
console.log(`${changed.length} URL(s) to submit.`);
for (const loc of changed) console.log(`  ${loc}`);
