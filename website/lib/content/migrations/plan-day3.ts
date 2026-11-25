/**
 * 30-day plan, Day 3: the /family-birthday-calendar page.
 *
 * The SEO team typed the hero copy and started the month-list section in
 * /seoteam, so that copy lives in Mongo and wins over the code. These pure
 * functions finish the job on the stored documents: they fill in the
 * January to December table and the tips under the "How to make a family
 * birthdays list in order by month" heading (adding the section under the hero
 * if it isn't there), and add the month-order FAQ question. Anything the team
 * already typed is kept. Both functions are idempotent.
 */
import {
  FAMILY_MONTH_LIST_GROUP,
  FAMILY_MONTH_LIST_HEADING,
  FAMILY_MONTH_TABLE,
  FAMILY_MONTH_TIPS,
  familyBirthdayCalendarPage as page,
} from "../seo-pages/family-birthday-calendar";

type Plain = Record<string, unknown>;

const isPlain = (v: unknown): v is Plain =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const clone = <T>(v: T): T => (v === undefined ? v : (JSON.parse(JSON.stringify(v)) as T));

export const DAY3_PATH = "/family-birthday-calendar";
export const DAY3_SLUG = "family-birthday-calendar";

export const DAY3_META = {
  title: page.title,
  description: page.description,
  keywords: [...page.keywords],
};

const NEW_FAQ = page.faq.items.find((item) => item.id === "faq-month-order")!;

const isMonthGroup = (item: unknown): item is Plain =>
  isPlain(item) &&
  item.kind === "blocks" &&
  typeof item.heading === "string" &&
  item.heading.trim().toLowerCase() === FAMILY_MONTH_LIST_HEADING.toLowerCase();

const hasRows = (block: Plain) =>
  Array.isArray(block.rows) &&
  block.rows.some((row) => isPlain(row) && Array.isArray(row.cells) && row.cells.some((c) => String(c).trim()));

/** The /seoteam/meta override for /family-birthday-calendar. */
export function migrateDay3Meta(doc: Plain): { next: Plain; changes: string[] } {
  const next = clone(doc);
  const changes: string[] = [];
  if (next.title !== DAY3_META.title) {
    changes.push(`Title: "${String(next.title ?? "")}" -> "${DAY3_META.title}"`);
    next.title = DAY3_META.title;
  }
  if (next.description !== DAY3_META.description) {
    changes.push("Meta description rewritten");
    next.description = DAY3_META.description;
  }
  if (JSON.stringify(next.keywords) !== JSON.stringify(DAY3_META.keywords)) {
    changes.push("Keywords updated");
    next.keywords = [...DAY3_META.keywords];
  }
  return { next, changes };
}

/** One stored /seoteam/seo-pages override (published or draft). */
export function migrateDay3PageContent(content: Plain): { next: Plain; changes: string[] } {
  const next = clone(content);
  const changes: string[] = [];

  // Title and description, where the override stores its own.
  for (const key of ["title", "description"] as const) {
    if (key in next && next[key] !== page[key]) {
      next[key] = page[key];
      changes.push(key === "title" ? "Title tag" : "Meta description");
    }
  }

  // The month-list section with its table and tips.
  if (Array.isArray(next.layout)) {
    const layout = next.layout as unknown[];
    const group = layout.find(isMonthGroup);
    if (!group) {
      const heroAt = layout.findIndex((it) => isPlain(it) && it.kind === "section" && it.section === "hero");
      layout.splice(heroAt + 1, 0, clone(FAMILY_MONTH_LIST_GROUP));
      changes.push(`Added "${FAMILY_MONTH_LIST_HEADING}" with the month table, under the hero`);
    } else {
      if (!(typeof group.sub === "string" && group.sub.trim())) {
        group.sub = FAMILY_MONTH_LIST_GROUP.sub;
        changes.push("Month list: sub-heading");
      }
      const blocks = (Array.isArray(group.blocks) ? group.blocks : []).filter(isPlain);
      const tableAt = blocks.findIndex((b) => b.type === "comparisonTable");
      if (tableAt === -1) {
        blocks.unshift(clone(FAMILY_MONTH_TABLE) as unknown as Plain);
        changes.push("Month list: added the January to December table");
      } else if (!hasRows(blocks[tableAt])) {
        blocks[tableAt] = { ...clone(FAMILY_MONTH_TABLE), id: blocks[tableAt].id ?? FAMILY_MONTH_TABLE.id };
        changes.push("Month list: filled in the January to December table");
      }
      if (!blocks.some((b) => b.type === "richText")) {
        const after = blocks.findIndex((b) => b.type === "comparisonTable");
        blocks.splice(after + 1, 0, clone(FAMILY_MONTH_TIPS) as unknown as Plain);
        changes.push("Month list: added the tips paragraph");
      }
      group.blocks = blocks;
    }
  }

  // The month-order FAQ question, unless someone already added it.
  if (isPlain(next.faq) && Array.isArray(next.faq.items)) {
    const items = next.faq.items as unknown[];
    const has = items.some(
      (it) => isPlain(it) && (it.id === NEW_FAQ.id || String(it.q ?? "").trim().toLowerCase() === NEW_FAQ.q.toLowerCase()),
    );
    if (!has) {
      next.faq.items = [...items, { ...NEW_FAQ }];
      changes.push(`FAQ: added "${NEW_FAQ.q}"`);
    }
  }

  return { next, changes };
}
