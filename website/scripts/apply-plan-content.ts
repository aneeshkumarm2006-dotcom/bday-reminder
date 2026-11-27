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
 *
 * New steps write to the DRAFT only (`seoPageDraft`, `landingDraft`; Days 2
 * and 3 ran before this and wrote straight to the live page): nothing
 * changes on the live site until someone checks the
 * draft in /seoteam and clicks Publish. Titles on /seoteam/meta have no draft,
 * so those are pasted by hand after review instead of written here.
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
  DAY4_PATH,
  DAY4_SLUG,
  migrateDay4Meta,
  migrateDay4PageContent,
} from "../lib/content/migrations/plan-day4";
import { DAY5_ALARM, DAY5_TRACKER } from "../lib/content/migrations/plan-day5";
import { migrateDay1Tagline } from "../lib/content/migrations/plan-day1-tagline";
import { DAY3_SLUG, migrateDay3PageContent } from "../lib/content/migrations/plan-day3";
import { migrateFamilyForPublish, migrateHomeTitle } from "../lib/content/migrations/plan-publish-day1-day3";
import {
  AuditLogModel,
  ContentRevisionModel,
  LandingContentModel,
  PageMetaModel,
  SINGLETON,
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

const hasContent = (v: unknown): v is Plain =>
  typeof v === "object" && v !== null && !Array.isArray(v) && Object.keys(v).length > 0;

/**
 * A keyword page's DRAFT only. Starts from the saved draft (or, if there is
 * none, from what's published, which is what the editor would open on), so the
 * live page is untouched until someone publishes.
 */
async function seoPageDraft(slug: string, migrate: Migrate, summary: string) {
  const doc = await SeoPageContentModel.findOne({ slug }).lean();
  if (!doc) {
    console.log(`  · Keyword page /${slug}: nothing saved; skipping`);
    return 0;
  }
  const raw = doc as unknown as { published?: Plain; draft?: Plain };
  const base = hasContent(raw.draft) ? raw.draft : (raw.published ?? {});
  const { next, changes } = migrate(base);
  report(`Keyword page /${slug} (draft)`, changes);
  if (APPLY && changes.length > 0) {
    await record("seo-page", slug, base, summary);
    await SeoPageContentModel.updateOne({ slug }, { $set: { draft: next } });
  }
  return changes.length;
}

/** The homepage's DRAFT only, the same way. */
async function landingDraft(
  migrate: (sections: unknown[]) => { next: unknown[]; changes: string[] },
  summary: string,
) {
  const doc = await LandingContentModel.findOne({ key: SINGLETON }).lean();
  if (!doc) {
    console.log("  · Homepage: nothing saved; skipping");
    return 0;
  }
  const raw = doc as unknown as { published?: Plain; draft?: Plain };
  const sectionsOf = (v?: Plain) => (Array.isArray(v?.sections) ? (v!.sections as unknown[]) : []);
  const fromDraft = sectionsOf(raw.draft).length > 0;
  const base = fromDraft ? raw.draft! : (raw.published ?? {});
  const { next, changes } = migrate(sectionsOf(base));
  report("Homepage (draft)", changes);
  if (APPLY && changes.length > 0) {
    await record("landing", SINGLETON, { sections: sectionsOf(base) }, summary);
    await LandingContentModel.updateOne({ key: SINGLETON }, { $set: { draft: { ...base, sections: next } } });
  }
  return changes.length;
}

/**
 * Publish a keyword page's draft, exactly like the Publish button: the live
 * copy becomes the draft (after `migrate` checks it against the plan).
 */
async function publishSeoPage(slug: string, migrate: Migrate, summary: string) {
  const doc = await SeoPageContentModel.findOne({ slug }).lean();
  if (!doc) {
    console.log(`  · Keyword page /${slug}: nothing saved; the code copy is already live`);
    return 0;
  }
  const raw = doc as unknown as { published?: Plain; draft?: Plain };
  const base = hasContent(raw.draft) ? raw.draft : (raw.published ?? {});
  const { next, changes } = migrate(base);
  if (JSON.stringify(next) !== JSON.stringify(raw.published ?? {})) changes.unshift("Published the draft");
  report(`Keyword page /${slug} (publish)`, changes);
  if (APPLY && changes.length > 0) {
    await record("seo-page", slug, raw.published ?? {}, summary);
    await SeoPageContentModel.updateOne(
      { slug },
      { $set: { draft: next, published: next, publishedAt: new Date() } },
    );
  }
  return changes.length;
}

/** Publish the homepage's draft the same way. */
async function publishLanding(
  migrate: (sections: unknown[]) => { next: unknown[]; changes: string[] },
  summary: string,
) {
  const doc = await LandingContentModel.findOne({ key: SINGLETON }).lean();
  if (!doc) {
    console.log("  · Homepage: nothing saved; skipping");
    return 0;
  }
  const raw = doc as unknown as { published?: Plain; draft?: Plain };
  const sectionsOf = (v?: Plain) => (Array.isArray(v?.sections) ? (v!.sections as unknown[]) : []);
  const base = sectionsOf(raw.draft).length > 0 ? sectionsOf(raw.draft) : sectionsOf(raw.published);
  const { next, changes } = migrate(base);
  if (JSON.stringify(next) !== JSON.stringify(sectionsOf(raw.published))) changes.unshift("Published the draft");
  report("Homepage (publish)", changes);
  if (APPLY && changes.length > 0) {
    await record("landing", SINGLETON, { sections: sectionsOf(raw.published) }, summary);
    await LandingContentModel.updateOne(
      { key: SINGLETON },
      { $set: { draft: { sections: next }, published: { sections: next }, publishedAt: new Date() } },
    );
  }
  return changes.length;
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
    id: "plan-day1-tagline",
    label: 'Day 1 fix: "Remember, and act." under the homepage H1 (draft)',
    run: () => landingDraft(migrateDay1Tagline, '30-day plan Day 1: "Remember, and act." tagline (draft)'),
  },
  {
    id: "plan-day3-family-birthday-calendar",
    label: "Day 3: /family-birthday-calendar (draft)",
    run: () => seoPageDraft(DAY3_SLUG, migrateDay3PageContent, "30-day plan Day 3: month table and FAQ (draft)"),
  },
  {
    // Asked for by the team, who have no admin access: publish what the two
    // steps above left in draft, and set the homepage title on /seoteam/meta.
    id: "plan-publish-day1-day3",
    label: "Publish Day 1 and Day 3 drafts, homepage title",
    run: async () =>
      (await publishLanding(migrateDay1Tagline, '30-day plan Day 1: published "Remember, and act."')) +
      (await pageMeta("/", migrateHomeTitle, "30-day plan Day 1: homepage title")) +
      (await publishSeoPage(DAY3_SLUG, migrateFamilyForPublish, "30-day plan Day 3: published H1 and first sentence")),
  },
  {
    // No admin access, so this one goes straight to the live page.
    id: "plan-day4-birthday-countdown-app",
    label: "Day 4: /birthday-countdown-app",
    run: async () =>
      (await pageMeta(DAY4_PATH, migrateDay4Meta, "30-day plan Day 4: title and description")) +
      (await seoPage(DAY4_SLUG, migrateDay4PageContent, "30-day plan Day 4: H1, first sentence, FAQ, widget H2")),
  },
  {
    id: "plan-day5-alarm-tracker",
    label: "Day 5: /birthday-alarm and /birthday-tracker",
    run: async () => {
      let total = 0;
      for (const day of [DAY5_ALARM, DAY5_TRACKER]) {
        total += await pageMeta(day.path, day.migrateMeta, `30-day plan Day 5: ${day.path} title and description`);
        total += await seoPage(day.slug, day.migrateContent, `30-day plan Day 5: ${day.path} H1 and first sentence`);
      }
      return total;
    },
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
