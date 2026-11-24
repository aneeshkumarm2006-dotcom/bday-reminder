/**
 * 30-day plan, Day 2: the /birthday-calendar page.
 *
 * The new copy ships in lib/content/seo-pages/birthday-calendar.ts, but the
 * live title and any copy the SEO team saved in /seoteam live in Mongo and win
 * over the code. These pure functions bring those stored documents in line,
 * touching only the fields Day 2 changes. Both are idempotent.
 * scripts/apply-plan-content.ts runs them during the build, once.
 */
import { birthdayCalendarPage } from "../seo-pages/birthday-calendar";

type Plain = Record<string, unknown>;

const isPlain = (v: unknown): v is Plain =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

const page = birthdayCalendarPage;

export const DAY2_PATH = "/birthday-calendar";
export const DAY2_SLUG = "birthday-calendar";

export const DAY2_META = {
  title: page.title,
  description: page.description,
  keywords: [...page.keywords],
};

const NEW_FAQ = page.faq.items.find((item) => item.id === "faq-iphone-android")!;
const ADD_STEP = page.howItWorks.steps.find((step) => step.id === "step-add")!;

/** The /seoteam/meta override for /birthday-calendar: title, description, keywords. */
export function migrateDay2Meta(doc: Plain): { next: Plain; changes: string[] } {
  const next = clone(doc);
  const changes: string[] = [];
  if (next.title !== DAY2_META.title) {
    changes.push(`Title: "${String(next.title ?? "")}" -> "${DAY2_META.title}"`);
    next.title = DAY2_META.title;
  }
  if (next.description !== DAY2_META.description) {
    changes.push("Meta description rewritten");
    next.description = DAY2_META.description;
  }
  if (JSON.stringify(next.keywords) !== JSON.stringify(DAY2_META.keywords)) {
    changes.push("Keywords updated");
    next.keywords = [...DAY2_META.keywords];
  }
  return { next, changes };
}

/**
 * One stored /seoteam/seo-pages override (published or draft). Fields the
 * override doesn't store already come from the new code copy, so only stored
 * ones are rewritten.
 */
export function migrateDay2PageContent(content: Plain): { next: Plain; changes: string[] } {
  const next = clone(content);
  const changes: string[] = [];
  const set = (target: Plain, key: string, value: unknown, label: string) => {
    if (key in target && JSON.stringify(target[key]) !== JSON.stringify(value)) {
      target[key] = value;
      changes.push(label);
    }
  };

  set(next, "title", page.title, "Title tag");
  set(next, "description", page.description, "Meta description");
  set(next, "keywords", [...page.keywords], "Keywords");

  if (isPlain(next.hero)) {
    set(next.hero, "badge", page.hero.badge, "Hero badge");
    set(next.hero, "heading", page.hero.heading, "H1");
    set(next.hero, "subheading", page.hero.subheading, "First sentence");
    if (isPlain(next.hero.primaryCta)) {
      set(next.hero.primaryCta, "label", page.hero.primaryCta.label, "Hero button");
    }
  }

  if (isPlain(next.features)) {
    set(next.features, "heading", page.features.heading, "H2: Sync birthdays with Google Calendar and Outlook");
    set(next.features, "sub", page.features.sub, "Features intro");
  }

  if (isPlain(next.howItWorks)) {
    set(next.howItWorks, "heading", page.howItWorks.heading, "H2: Birthday calendar for iPhone and Android");
    if (Array.isArray(next.howItWorks.steps)) {
      for (const step of next.howItWorks.steps) {
        if (isPlain(step) && step.id === ADD_STEP.id) set(step, "body", ADD_STEP.body, "Step 1 text");
      }
    }
  }

  if (isPlain(next.faq) && Array.isArray(next.faq.items)) {
    const items = next.faq.items as unknown[];
    if (!items.some((it) => isPlain(it) && (it.id === NEW_FAQ.id || it.q === NEW_FAQ.q))) {
      next.faq.items = [...items, { ...NEW_FAQ }];
      changes.push(`FAQ: added "${NEW_FAQ.q}"`);
    }
  }

  if (isPlain(next.cta)) set(next.cta, "ctaLabel", page.cta.ctaLabel, "Closing button");

  return { next, changes };
}
