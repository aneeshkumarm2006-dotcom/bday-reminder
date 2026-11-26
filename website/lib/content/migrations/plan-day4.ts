/**
 * 30-day plan, Day 4: the /birthday-countdown-app page.
 *
 * The new copy ships in lib/content/seo-pages/birthday-countdown-app.ts, but
 * the live title and the copy the SEO team saved in /seoteam live in Mongo and
 * win over the code. These pure functions bring the stored documents in line.
 * The team has no admin access right now, so the build writes the live copy
 * (published and draft) instead of leaving a draft to publish. Idempotent.
 */
import {
  BIRTHDAY_COUNTDOWN_ACCURACY_ANSWER,
  COUNTDOWN_WIDGET_GROUP,
  COUNTDOWN_WIDGET_HEADING,
  birthdayCountdownAppPage as page,
} from "../seo-pages/birthday-countdown-app";

type Plain = Record<string, unknown>;

const isPlain = (v: unknown): v is Plain =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

export const DAY4_PATH = "/birthday-countdown-app";
export const DAY4_SLUG = "birthday-countdown-app";

export const DAY4_META = {
  title: page.title,
  description: page.description,
  keywords: [...page.keywords],
};

/** An FAQ answer that promises more than whole days. */
const SAYS_HOURS = /\b(hours?|minutes?|seconds?)\b/i;

/** The /seoteam/meta override for /birthday-countdown-app. */
export function migrateDay4Meta(doc: Plain): { next: Plain; changes: string[] } {
  const next = clone(doc);
  const changes: string[] = [];
  if (next.title !== DAY4_META.title) {
    changes.push(`Title: "${String(next.title ?? "")}" -> "${DAY4_META.title}"`);
    next.title = DAY4_META.title;
  }
  if (next.description !== DAY4_META.description) {
    changes.push("Meta description rewritten");
    next.description = DAY4_META.description;
  }
  if (JSON.stringify(next.keywords) !== JSON.stringify(DAY4_META.keywords)) {
    changes.push("Keywords updated");
    next.keywords = [...DAY4_META.keywords];
  }
  return { next, changes };
}

/** One stored /seoteam/seo-pages override (published or draft). */
export function migrateDay4PageContent(content: Plain): { next: Plain; changes: string[] } {
  const next = clone(content);
  const changes: string[] = [];
  const set = (target: Plain, key: string, value: unknown, label: string, always = false) => {
    if ((always || key in target) && JSON.stringify(target[key]) !== JSON.stringify(value)) {
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
    set(next.hero, "subheading", page.hero.subheading, "First sentence: birthday countdown app");
  }

  // The FAQ answer that said days, hours, minutes and seconds.
  if (isPlain(next.faq) && Array.isArray(next.faq.items)) {
    for (const item of next.faq.items) {
      if (isPlain(item) && typeof item.a === "string" && item.a !== BIRTHDAY_COUNTDOWN_ACCURACY_ANSWER && SAYS_HOURS.test(item.a)) {
        item.a = BIRTHDAY_COUNTDOWN_ACCURACY_ANSWER;
        changes.push(`FAQ: "${String(item.q ?? "")}" now says days only`);
      }
    }
  }

  // The "Birthday countdown widget" H2, right after the features.
  if (Array.isArray(next.layout)) {
    const layout = next.layout as unknown[];
    const has = layout.some(
      (it) =>
        isPlain(it) &&
        typeof it.heading === "string" &&
        it.heading.trim().toLowerCase() === COUNTDOWN_WIDGET_HEADING.toLowerCase(),
    );
    if (!has) {
      const after = layout.findIndex((it) => isPlain(it) && it.kind === "section" && it.section === "features");
      const at = after === -1 ? Math.max(layout.findIndex((it) => isPlain(it) && it.section === "faq"), 0) : after + 1;
      layout.splice(at, 0, clone(COUNTDOWN_WIDGET_GROUP));
      changes.push(`Added H2 "${COUNTDOWN_WIDGET_HEADING}"`);
    }
  }

  return { next, changes };
}
