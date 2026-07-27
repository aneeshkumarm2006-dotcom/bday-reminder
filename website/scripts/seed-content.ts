/**
 * Seed the content collections with the built-in defaults.
 *
 * Optional — the site renders identically without it, because every read
 * deep-merges over `lib/content/defaults.ts`. What it buys you is an admin that
 * opens *pre-populated* rather than showing empty inputs with placeholder
 * hints, which is a much better first run for the SEO team.
 *
 *   npx tsx scripts/seed-content.ts          # only fills what's missing
 *   npx tsx scripts/seed-content.ts --force  # overwrite existing documents
 *
 * Reads MONGODB_URI from the environment (or website/.env.local).
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import mongoose from "mongoose";

import {
  DEFAULT_LANDING,
  DEFAULT_LEGAL,
  DEFAULT_NAV,
  DEFAULT_PAGE_META,
  DEFAULT_SETTINGS,
} from "../lib/content/defaults";
import {
  LandingContentModel,
  LegalDocModel,
  NavigationConfigModel,
  PageMetaModel,
  SINGLETON,
  SiteSettingsModel,
} from "../lib/content/models";

const force = process.argv.includes("--force");

/** Minimal .env.local reader so the script works without extra dependencies. */
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
    /* no .env.local — the env var may still be set another way */
  }
}

/**
 * Upsert a singleton, skipping documents that already exist unless --force.
 * Typed structurally rather than against `Model<T>`: the five models have five
 * different document types and this only ever touches `key`.
 */
interface SingletonModel {
  findOne: (filter: object) => { lean: () => Promise<unknown> };
  findOneAndUpdate: (
    filter: object,
    update: object,
    options: object,
  ) => { lean: () => Promise<unknown> } | Promise<unknown>;
}

async function seedSingleton(
  label: string,
  model: SingletonModel,
  fields: Record<string, unknown>,
): Promise<void> {
  const existing = await model.findOne({ key: SINGLETON }).lean();
  if (existing && !force) {
    console.log(`· ${label} already exists — skipped (use --force to overwrite)`);
    return;
  }
  await model.findOneAndUpdate(
    { key: SINGLETON },
    { $set: { ...fields, key: SINGLETON } },
    { upsert: true, setDefaultsOnInsert: true },
  );
  console.log(`✓ ${label} seeded`);
}

async function main(): Promise<void> {
  loadEnvLocal();
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error(
      "MONGODB_URI is not set. Add it to website/.env.local, or export it, then re-run.",
    );
    process.exit(1);
  }

  await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  console.log(`Connected to ${mongoose.connection.name}\n`);

  await seedSingleton("Site settings", SiteSettingsModel, {
    identity: DEFAULT_SETTINGS.identity,
    seo: DEFAULT_SETTINGS.seo,
    analytics: DEFAULT_SETTINGS.analytics,
    socials: DEFAULT_SETTINGS.socials,
    announcement: DEFAULT_SETTINGS.announcement,
    robotsExtraDisallows: DEFAULT_SETTINGS.robotsExtraDisallows,
    llmsTxtEnabled: DEFAULT_SETTINGS.llmsTxtEnabled,
    structuredData: DEFAULT_SETTINGS.structuredData,
  });

  // Seed both variants so the editor opens on the live copy and Publish is a
  // real no-op rather than an empty diff.
  await seedSingleton("Landing page", LandingContentModel, {
    draft: DEFAULT_LANDING,
    published: DEFAULT_LANDING,
    publishedAt: new Date(),
  });

  await seedSingleton("Navigation", NavigationConfigModel, {
    header: DEFAULT_NAV.header,
    footer: DEFAULT_NAV.footer,
  });

  for (const [path, meta] of Object.entries(DEFAULT_PAGE_META)) {
    const existing = await PageMetaModel.findOne({ path }).lean();
    if (existing && !force) {
      console.log(`· Page SEO ${path} already exists — skipped`);
      continue;
    }
    const fields: Record<string, unknown> = { ...meta };
    delete fields.path; // the path is the key, set explicitly below
    await PageMetaModel.findOneAndUpdate(
      { path },
      { $set: { ...fields, path } },
      { upsert: true, setDefaultsOnInsert: true },
    );
    console.log(`✓ Page SEO ${path} seeded`);
  }

  for (const doc of Object.values(DEFAULT_LEGAL)) {
    const existing = await LegalDocModel.findOne({ key: doc.key }).lean();
    if (existing && !force) {
      console.log(`· Legal ${doc.key} already exists — skipped`);
      continue;
    }
    await LegalDocModel.findOneAndUpdate(
      { key: doc.key },
      { $set: doc },
      { upsert: true, setDefaultsOnInsert: true },
    );
    console.log(`✓ Legal ${doc.key} seeded`);
  }

  console.log("\nDone. Open /seoteam to start editing.");
  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await mongoose.disconnect().catch(() => undefined);
  process.exit(1);
});
