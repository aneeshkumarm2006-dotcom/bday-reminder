/**
 * 30-day plan, Day 5: /birthday-alarm and /birthday-tracker.
 *
 * The new copy ships in lib/content/seo-pages/, but the live titles and any
 * copy saved in /seoteam live in Mongo and win over the code. These pure
 * functions bring the stored documents in line: title, description, keywords,
 * the keyword H1, the old H1 kept as the line under it, and a first sentence
 * with the keyword. The FAQs already meet the plan and are left alone.
 * Idempotent; the build writes the live copy (the team has no admin access).
 */
import { birthdayAlarmPage } from "../seo-pages/birthday-alarm";
import { birthdayTrackerPage } from "../seo-pages/birthday-tracker";
import type { SeoLandingPageSource } from "../seo-pages/types";

type Plain = Record<string, unknown>;
type Result = { next: Plain; changes: string[] };

const isPlain = (v: unknown): v is Plain =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function forPage(page: SeoLandingPageSource) {
  const meta = { title: page.title, description: page.description, keywords: [...page.keywords] };

  /** The /seoteam/meta override for the page. */
  const migrateMeta = (doc: Plain): Result => {
    const next = clone(doc);
    const changes: string[] = [];
    if (next.title !== meta.title) {
      changes.push(`Title: "${String(next.title ?? "")}" -> "${meta.title}"`);
      next.title = meta.title;
    }
    if (next.description !== meta.description) {
      changes.push("Meta description rewritten");
      next.description = meta.description;
    }
    if (!same(next.keywords, meta.keywords)) {
      changes.push("Keywords updated");
      next.keywords = [...meta.keywords];
    }
    return { next, changes };
  };

  /** One stored /seoteam/seo-pages override (published or draft). */
  const migrateContent = (content: Plain): Result => {
    const next = clone(content);
    const changes: string[] = [];
    const set = (target: Plain, key: string, value: unknown, label: string, always = false) => {
      if ((always || key in target) && !same(target[key], value)) {
        target[key] = value;
        changes.push(label);
      }
    };
    set(next, "title", page.title, "Title tag");
    set(next, "description", page.description, "Meta description");
    set(next, "keywords", [...page.keywords], "Keywords");
    if (isPlain(next.hero)) {
      set(next.hero, "heading", page.hero.heading, `H1: "${page.hero.heading}"`);
      set(next.hero, "tagline", page.hero.tagline, "Old H1 kept as the line under it", true);
      set(next.hero, "subheading", page.hero.subheading, "First sentence with the keyword");
    }
    return { next, changes };
  };

  return { meta, migrateMeta, migrateContent };
}

export const DAY5_ALARM = { path: "/birthday-alarm", slug: "birthday-alarm", ...forPage(birthdayAlarmPage) };
export const DAY5_TRACKER = { path: "/birthday-tracker", slug: "birthday-tracker", ...forPage(birthdayTrackerPage) };
