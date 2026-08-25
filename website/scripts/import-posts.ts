/**
 * Import blog posts from a folder of HTML + JSON pairs into the CMS.
 *
 * Posts live in Mongo, not the repo — the SEO team owns them in `/seoteam`, and
 * nothing about a post's copy should be committed as code. But a post drafted
 * outside the editor (from a brief, from a doc) still has to get *in*, and
 * pasting 160 list items into a rich-text field by hand is how markup gets
 * mangled. This is that one seam: a file on disk becomes a draft in the CMS,
 * through exactly the same sanitizer the editor's save path uses.
 *
 *   npx tsx scripts/import-posts.ts "../_ai_context/blog posts"
 *   npx tsx scripts/import-posts.ts <dir> --publish   # go straight to visible
 *   npx tsx scripts/import-posts.ts <dir> --force     # overwrite an existing slug
 *
 * A folder holds `<name>.html` (the body) beside `<name>.json` (the fields the
 * editor would otherwise ask for). Everything is keyed on `slug`, so a re-run
 * is an update rather than a second copy.
 *
 * Drafts by default, deliberately: an import is a bulk write to the live site,
 * and "review it in the editor, then publish" is one click away. `--publish` is
 * there for when that review already happened.
 *
 * Reads MONGODB_URI from the environment, `website/.env.local`, or `backend/.env`.
 */
import { readFileSync, readdirSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

import mongoose from "mongoose";

import { Post } from "../lib/blog/models";
import { sanitizePostHtml } from "../lib/blog/sanitize";
import { createPostSchema } from "../lib/blog/validation";

const args = process.argv.slice(2);
const flags = new Set(args.filter((a) => a.startsWith("--")));
const dirArg = args.find((a) => !a.startsWith("--"));
const publish = flags.has("--publish");
const force = flags.has("--force");

/**
 * Minimal .env reader, matching `seed-content.ts` — this script has to run from
 * a bare checkout with no dotenv installed. `backend/.env` is the fallback
 * because the API and the website share one database (and one URI).
 */
function loadEnv(): void {
  if (process.env.MONGODB_URI) return;
  for (const file of [".env.local", "../backend/.env"]) {
    try {
      for (const line of readFileSync(resolve(process.cwd(), file), "utf8").split("\n")) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!match) continue;
        const value = match[2].trim().replace(/^["']|["']$/g, "");
        if (!process.env[match[1]]) process.env[match[1]] = value;
      }
    } catch {
      /* not there — try the next one */
    }
    if (process.env.MONGODB_URI) return;
  }
}

function fail(message: string): never {
  console.error(`✗ ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  if (!dirArg) fail('Usage: npx tsx scripts/import-posts.ts <dir> [--publish] [--force]');

  const dir = resolve(process.cwd(), dirArg);
  const names = readdirSync(dir)
    .filter((f) => extname(f).toLowerCase() === ".json")
    .map((f) => basename(f, ".json"))
    .sort();
  if (names.length === 0) fail(`No .json post files in ${dir}`);

  loadEnv();
  if (!process.env.MONGODB_URI) fail("MONGODB_URI is not set.");

  mongoose.set("strictQuery", true);
  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 10_000 });
  console.log(`· connected to ${mongoose.connection.name}`);

  for (const name of names) {
    const meta = JSON.parse(readFileSync(join(dir, `${name}.json`), "utf8")) as Record<
      string,
      unknown
    >;
    const html = readFileSync(join(dir, `${name}.html`), "utf8");

    // Parse through the same schema the API route uses, so a bad template key or
    // an over-long meta title fails here rather than half-way through a write.
    const parsed = createPostSchema.safeParse({
      ...meta,
      body: html,
      status: publish ? "published" : "draft",
    });
    if (!parsed.success) {
      fail(`${name}: ${parsed.error.issues[0]?.message} (${parsed.error.issues[0]?.path.join(".")})`);
    }
    const data = parsed.data;
    const slug = (data.slug || name).trim().toLowerCase();

    // Same sanitizer as the editor's save path: an import must not be a way to
    // get markup into a post that the editor itself would have stripped.
    const body = sanitizePostHtml(data.body);
    if (body.length !== html.length) {
      console.log(`  ! ${slug}: sanitizer changed the body (${html.length} → ${body.length} bytes)`);
    }

    const existing = await Post.findOne({ slug }).lean();
    if (existing && !force) {
      console.log(`· ${slug} already exists — skipped (use --force to overwrite)`);
      continue;
    }

    const fields = {
      title: data.title,
      slug,
      template: data.template,
      body,
      excerpt: data.excerpt,
      metaTitle: data.metaTitle,
      coverImage: data.coverImage,
      coverImageAlt: data.coverImageAlt,
      keywords: data.keywords,
      linkOccurrences: data.linkOccurrences,
      author: data.author,
      status: data.status,
      // Never demote a post that is already live: an import that silently
      // unpublished a page would be a traffic incident, not a content update.
      publishedAt:
        data.status === "published"
          ? (existing?.publishedAt ?? new Date())
          : (existing?.publishedAt ?? null),
    };

    await Post.findOneAndUpdate({ slug }, { $set: fields }, { upsert: true, new: true });
    console.log(`${existing ? "↻ updated" : "+ created"} ${slug} (${fields.status})`);
  }

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
