/**
 * Publishes the Day 1 and Day 3 drafts, the same thing the Publish button in
 * /seoteam does (live copy = draft), for a team with no admin access, and
 * sets the plan's homepage title on /seoteam/meta.
 *
 * On the way it makes sure the copy matches the plan even if a draft is
 * missing a piece: the homepage hero keeps "Remember, and act." under the H1,
 * and the family page hero gets the plan's H1 and opening sentence.
 * Pure and idempotent.
 */
import { familyBirthdayCalendarPage as family } from "../seo-pages/family-birthday-calendar";
import { migrateDay3PageContent } from "./plan-day3";

type Plain = Record<string, unknown>;

const isPlain = (v: unknown): v is Plain =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const HOME_PLAN_TITLE = "Birthday Reminders: Free Birthday Reminder App for iPhone & Android";

/** /seoteam/meta for "/": only the title changes. */
export function migrateHomeTitle(doc: Plain): { next: Plain; changes: string[] } {
  if (doc.title === HOME_PLAN_TITLE) return { next: doc, changes: [] };
  return {
    next: { ...doc, title: HOME_PLAN_TITLE },
    changes: [`Title: "${String(doc.title ?? "")}" -> "${HOME_PLAN_TITLE}"`],
  };
}

/** The family page: Day 3 table, tips and FAQ, plus the plan's H1 and first sentence. */
export function migrateFamilyForPublish(content: Plain): { next: Plain; changes: string[] } {
  const { next, changes } = migrateDay3PageContent(content);
  const hero: Plain = isPlain(next.hero) ? next.hero : {};
  if (hero.heading !== family.hero.heading) {
    hero.heading = family.hero.heading;
    changes.push(`H1: "${family.hero.heading}"`);
  }
  if (hero.subheading !== family.hero.subheading) {
    hero.subheading = family.hero.subheading;
    changes.push("First sentence: the family birthdays list line");
  }
  next.hero = hero;
  return { next, changes };
}
