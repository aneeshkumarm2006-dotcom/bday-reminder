/**
 * Push the Nov 2026 landing redesign's copy into the saved /seoteam content.
 *
 * The redesign changed the built-in defaults, but whatever the SEO team saved
 * in the admin lives in Mongo and wins over them. This applies the same edits
 * an editor would make by hand (see lib/content/migrations/redesign-2026-11.ts):
 *
 *   - Site settings → App stores on, with the live listing URLs; Clarity ID
 *   - Navigation   → drop "Coming soon", add Screenshots / FAQ / Blog,
 *                    header button "Get the app"
 *   - Landing      → new hero copy + store line, the app-name FAQ, and
 *                    "Get the app" without the coming-soon footnote
 *                    (published AND draft, so the editor opens on the new copy)
 *   - Homepage meta → the 30-day plan's Day 1 title and description
 *   - Keyword pages → clear any saved "Mobile apps coming soon." footnote
 *
 * Like an admin save, every changed document gets a revision snapshot first
 * (undo it from /seoteam → Revisions) and an Activity-log entry.
 *
 *   npx tsx scripts/apply-redesign-content.ts           # dry run: shows the changes
 *   npx tsx scripts/apply-redesign-content.ts --apply   # writes them
 *
 * Reads MONGODB_URI from the environment (or website/.env.local). Safe to run
 * more than once: a second run finds nothing left to change.
 *
 * Direct database writes don't revalidate Next's cache, so the homepage shows
 * the new copy after the next deploy, or within the hour (its ISR window).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import mongoose from "mongoose";

import {
  migrateHomeMeta,
  migrateLandingSections,
  migrateNavigation,
  migrateSeoPageContent,
  migrateSiteSettings,
} from "../lib/content/migrations/redesign-2026-11";
import {
  AuditLogModel,
  ContentRevisionModel,
  LandingContentModel,
  NavigationConfigModel,
  PageMetaModel,
  SINGLETON,
  SeoPageContentModel,
  SiteSettingsModel,
} from "../lib/content/models";

const APPLY = process.argv.includes("--apply");
const EDITOR = "Redesign script (Nov 2026)";

/** Minimal .env.local reader, same as scripts/seed-content.ts. */
function loadEnvLocal(): void {
  if (process.env.MONGODB_URI) return;
  try {
    const file = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of file.split("\n")) {
      const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (!match) continue;
      const value = match[2].replace(/^["']|["']$/g, "");
      if (!process.env[match[1]]) process.env[match[1]] = value;
    }
  } catch {
    /* no .env.local; the variable may be set another way */
  }
}

type Plain = Record<string, unknown>;

/** Strip Mongo bookkeeping so a snapshot or $set carries content fields only. */
function contentFields(doc: Plain): Plain {
  const rest = { ...doc };
  for (const key of ["_id", "__v", "createdAt", "updatedAt"]) delete rest[key];
  return rest;
}

async function record(entityType: string, entityId: string, snapshot: unknown, summary: string) {
  await ContentRevisionModel.create({ entityType, entityId, snapshot, savedBy: EDITOR });
  await AuditLogModel.create({ action: "update", entityType, entityId, summary, editor: EDITOR });
}

function report(label: string, changes: string[]) {
  if (changes.length === 0) {
    console.log(`· ${label}: nothing to change`);
    return;
  }
  console.log(`${APPLY ? "✓" : "→"} ${label}:`);
  for (const change of changes) console.log(`    - ${change}`);
}

async function siteSettings() {
  const doc = await SiteSettingsModel.findOne({ key: SINGLETON }).lean();
  if (!doc) {
    console.log("· Site settings: none saved; the new defaults already apply");
    return 0;
  }
  const before = contentFields(doc as unknown as Plain);
  const { next, changes } = migrateSiteSettings(before);
  report("Site settings", changes);
  if (APPLY && changes.length > 0) {
    await record("site", SINGLETON, before, "Redesign: app stores live, Clarity on");
    await SiteSettingsModel.updateOne(
      { key: SINGLETON },
      { $set: { appStores: next.appStores, analytics: next.analytics } },
    );
  }
  return changes.length;
}

async function navigation() {
  const doc = await NavigationConfigModel.findOne({ key: SINGLETON }).lean();
  if (!doc) {
    console.log("· Navigation: none saved; the new defaults already apply");
    return 0;
  }
  const before = contentFields(doc as unknown as Plain);
  const { next, changes } = migrateNavigation(before);
  report("Navigation", changes);
  if (APPLY && changes.length > 0) {
    await record("navigation", SINGLETON, before, "Redesign: header links and Get the app button");
    await NavigationConfigModel.updateOne({ key: SINGLETON }, { $set: { header: next.header } });
  }
  return changes.length;
}

async function landing() {
  const doc = await LandingContentModel.findOne({ key: SINGLETON }).lean();
  if (!doc) {
    console.log("· Landing page: none saved; the new defaults already apply");
    return 0;
  }
  const raw = doc as unknown as { published?: Plain; draft?: Plain };
  const published = Array.isArray(raw.published?.sections) ? (raw.published!.sections as unknown[]) : [];
  const draft = Array.isArray(raw.draft?.sections) ? (raw.draft!.sections as unknown[]) : [];

  const pub = migrateLandingSections(published);
  const drf = migrateLandingSections(draft);
  report("Landing page (published)", published.length ? pub.changes : []);
  report("Landing page (draft)", draft.length ? drf.changes : []);

  const total = (published.length ? pub.changes.length : 0) + (draft.length ? drf.changes.length : 0);
  if (APPLY && total > 0) {
    await record(
      "landing",
      SINGLETON,
      { sections: published.length ? published : draft },
      "Redesign: new hero copy, app-name FAQ, Get the app footnote",
    );
    const set: Plain = {};
    if (published.length && pub.changes.length) {
      set.published = { ...raw.published, sections: pub.next };
      set.publishedAt = new Date();
    }
    if (draft.length && drf.changes.length) set.draft = { ...raw.draft, sections: drf.next };
    await LandingContentModel.updateOne({ key: SINGLETON }, { $set: set });
  }
  return total;
}

async function homeMeta() {
  const doc = await PageMetaModel.findOne({ path: "/" }).lean();
  if (!doc) {
    console.log("· Homepage title: none saved; the new default already applies");
    return 0;
  }
  const before = contentFields(doc as unknown as Plain);
  const { next, changes } = migrateHomeMeta(before);
  report("Homepage title and description", changes);
  if (APPLY && changes.length > 0) {
    await record("meta", "/", before, "30-day plan Day 1: homepage title and description");
    await PageMetaModel.updateOne(
      { path: "/" },
      { $set: { title: next.title, description: next.description } },
    );
  }
  return changes.length;
}

async function keywordPages() {
  const docs = await SeoPageContentModel.find({}).lean();
  let total = 0;
  for (const doc of docs) {
    const raw = doc as unknown as { slug: string; published?: Plain; draft?: Plain };
    const pub = migrateSeoPageContent(raw.published ?? {});
    const drf = migrateSeoPageContent(raw.draft ?? {});
    const count = pub.changes.length + drf.changes.length;
    report(`Keyword page /${raw.slug}`, [...pub.changes, ...drf.changes.map((c) => `${c} (draft)`)]);
    if (APPLY && count > 0) {
      await record("seo-page", raw.slug, raw.published ?? {}, "Redesign: removed coming-soon footnote");
      await SeoPageContentModel.updateOne(
        { slug: raw.slug },
        { $set: { published: pub.next, draft: drf.next } },
      );
    }
    total += count;
  }
  if (docs.length === 0) console.log("· Keyword pages: none saved; the new defaults already apply");
  return total;
}

async function main(): Promise<void> {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set. Export it or put it in website/.env.local.");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log(APPLY ? "Applying the redesign content…\n" : "Dry run: nothing is written. Add --apply to save.\n");

  const total =
    (await siteSettings()) +
    (await navigation()) +
    (await landing()) +
    (await homeMeta()) +
    (await keywordPages());

  console.log(
    `\n${total} change${total === 1 ? "" : "s"} ${APPLY ? "saved" : "to make"}.` +
      (APPLY && total > 0
        ? " Each changed document has a revision in /seoteam → Revisions. Redeploy (or wait up to an hour) for the homepage cache to refresh."
        : ""),
  );
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
