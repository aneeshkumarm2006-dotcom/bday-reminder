/**
 * 30-day plan, Day 1, item 2: "Keep the current line as a subheading."
 *
 * The homepage's old H1, "Remember, and act.", comes back as the hero's
 * tagline, the short line right under the new H1. The paragraph after it still
 * opens with the "birthday reminders" / "birthday app" sentence (item 3).
 * Pure and idempotent; a tagline someone already typed is kept.
 */
type Plain = Record<string, unknown>;

const isPlain = (v: unknown): v is Plain =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const HOME_TAGLINE = "Remember, and act.";

export function migrateDay1Tagline(sections: unknown[]): { next: unknown[]; changes: string[] } {
  const changes: string[] = [];
  const next = sections.map((raw) => {
    if (!isPlain(raw) || raw.type !== "hero") return raw;
    if (typeof raw.tagline === "string" && raw.tagline.trim()) return raw;
    changes.push(`Hero: tagline "${HOME_TAGLINE}" under the H1`);
    return { ...raw, tagline: HOME_TAGLINE };
  });
  return { next, changes };
}
