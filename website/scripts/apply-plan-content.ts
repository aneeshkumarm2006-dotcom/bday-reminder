/**
 * Apply the 30-day plan's page edits to the copy saved in /seoteam.
 *
 * Each day's edits ship in code, but whatever the SEO team saved in the admin
 * lives in Mongo and wins over the code. This brings the saved documents in
 * line, like an editor would by hand: every changed document gets a revision
 * first (undo it from /seoteam -> Revisions) and an Activity-log entry.
 *
 *   npx tsx scripts/apply-plan-content.ts           # dry run
 *   npx tsx scripts/apply-plan-content.ts --apply   # writes
 *   npx tsx scripts/apply-plan-content.ts --auto    # build mode (npm run build)
 *
 * `--auto` applies each step once: a marker in `content_migrations` records it,
 * so later builds skip it and never undo an edit made in /seoteam afterwards.
 * Nothing in this mode can fail the build; no database or an error just logs a
 * warning. To add a day, add a step to STEPS with a new id.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import mongoose from "mongoose";

import {
  DAY2_PATH,
  DAY2_SLUG,
  migrateDay2Meta,
  migrateDay2PageContent,
} from "../lib/content/migrations/plan-day2";
import {
  DAY3_PATH,
  DAY3_SLUG,
  migrateDay3Meta,
  migrateDay3PageContent,
} from "../lib/content/migrations/plan-day3";
import {
  AuditLogModel,
  ContentRevisionModel,
  PageMetaModel,
  SeoPageContentModel,
} from "../lib/content/models";

const AUTO = process.argv.includes("--auto");
const APPLY = AUTO || process.argv.includes("--apply");
const EDITOR = "30-day plan script";

type Plain = Record<string, unknown>;
type Migrate = (doc: Plain) => { next: Plain; changes: string[] };

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
    console.log(`  · ${label}: nothing to change`);
    return;
  }
  console.log(`  ${APPLY ? "✓" : "→"} ${label}:`);
  for (const change of changes) console.log(`      - ${change}`);
}

/** The /seoteam/meta override for one path. */
async function pageMeta(path: string, migrate: Migrate, summary: string) {
  const doc = await PageMetaModel.findOne({ path }).lean();
  if (!doc) {
    console.log(`  · SEO meta ${path}: none saved; the new code copy applies`);
    return 0;
  }
  const before = contentFields(doc as unknown as Plain);
  const { next, changes } = migrate(before);
  report(`SEO meta ${path}`, changes);
  if (APPLY && changes.length > 0) {
    await record("meta", path, before, summary);
    await PageMetaModel.updateOne(
      { path },
      { $set: { title: next.title, description: next.description, keywords: next.keywords } },
    );
  }
  return changes.length;
}

/** The /seoteam/seo-pages override (published and draft) for one keyword page. */
async function seoPage(slug: string, migrate: Migrate, summary: string) {
  const doc = await SeoPageContentModel.findOne({ slug }).lean();
  if (!doc) {
    console.log(`  · Keyword page /${slug}: none saved; the new code copy applies`);
    return 0;
  }
  const raw = doc as unknown as { published?: Plain; draft?: Plain };
  const pub = migrate(raw.published ?? {});
  const drf = migrate(raw.draft ?? {});
  report(`Keyword page /${slug} (published)`, pub.changes);
  report(`Keyword page /${slug} (draft)`, drf.changes);
  const count = pub.changes.length + drf.changes.length;
  if (APPLY && count > 0) {
    await record("seo-page", slug, raw.published ?? {}, summary);
    const set: Plain = {};
    if (pub.changes.length) set.published = pub.next;
    if (drf.changes.length) set.draft = drf.next;
    await SeoPageContentModel.updateOne({ slug }, { $set: set });
  }
  return count;
}

const STEPS: { id: string; label: string; run: () => Promise<number> }[] = [
  {
    id: "plan-day2-birthday-calendar",
    label: "Day 2: /birthday-calendar",
    run: async () =>
      (await pageMeta(DAY2_PATH, migrateDay2Meta, "30-day plan Day 2: title and description")) +
      (await seoPage(DAY2_SLUG, migrateDay2PageContent, "30-day plan Day 2: H1, first sentence, H2s, FAQ")),
  },
  {
    id: "plan-day3-family-birthday-calendar",
    label: "Day 3: /family-birthday-calendar",
    run: async () =>
      (await pageMeta(DAY3_PATH, migrateDay3Meta, "30-day plan Day 3: title and description")) +
      (await seoPage(DAY3_SLUG, migrateDay3PageContent, "30-day plan Day 3: month table and FAQ")),
  },
];

async function main(): Promise<void> {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    if (AUTO) {
      console.log("[plan content] MONGODB_URI not set; skipping.");
      return;
    }
    console.error("MONGODB_URI is not set. Export it or put it in website/.env.local.");
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
  const markers = mongoose.connection.db!.collection<{ _id: string }>("content_migrations");

  for (const step of STEPS) {
    if (AUTO && (await markers.findOne({ _id: step.id }))) {
      console.log(`[plan content] ${step.label}: already applied; skipping.`);
      continue;
    }
    console.log(`[plan content] ${step.label}${APPLY ? "" : " (dry run)"}`);
    const total = await step.run();
    console.log(`  ${total} change${total === 1 ? "" : "s"} ${APPLY ? "saved" : "to make"}.`);
    if (APPLY) {
      await markers.updateOne(
        { _id: step.id },
        { $set: { appliedAt: new Date(), changes: total, mode: AUTO ? "build" : "manual" } },
        { upsert: true },
      );
    }
  }
  await mongoose.disconnect();
}

main().catch(async (err) => {
  await mongoose.disconnect().catch(() => {});
  if (AUTO) {
    console.warn("[plan content] skipped, the build continues:", err instanceof Error ? err.message : err);
    process.exit(0);
  }
  console.error(err);
  process.exit(1);
});
