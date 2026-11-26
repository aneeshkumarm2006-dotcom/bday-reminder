import { describe, expect, it } from "vitest";

import { DEFAULT_PAGE_META } from "../defaults";
import { HOME_TAGLINE, migrateDay1Tagline } from "../migrations/plan-day1-tagline";
import { landingSectionSchema } from "../validation";

describe("Day 1 fixes", () => {
  it("uses the plan's homepage title word for word", () => {
    expect(DEFAULT_PAGE_META["/"].title).toBe(
      "Birthday Reminders: Free Birthday Reminder App for iPhone & Android",
    );
  });

  it("adds the tagline to the hero only, once, and keeps one someone typed", () => {
    const sections = [
      { id: "hero", type: "hero", heading: "H1" },
      { id: "faq", type: "faq", items: [] },
    ];
    const { next, changes } = migrateDay1Tagline(sections);
    expect(next[0]).toMatchObject({ tagline: HOME_TAGLINE, heading: "H1" });
    expect(next[1]).toBe(sections[1]);
    expect(changes).toHaveLength(1);
    expect(migrateDay1Tagline(next).changes).toEqual([]);
    expect(migrateDay1Tagline([{ type: "hero", tagline: "Mine" }]).next[0]).toMatchObject({ tagline: "Mine" });
  });

  it("lets the admin save a tagline", () => {
    const parsed = landingSectionSchema.parse({
      id: "hero",
      type: "hero",
      heading: "H1",
      tagline: HOME_TAGLINE,
      primaryCta: { label: "", href: "/" },
      secondaryCta: { label: "", href: "/" },
    });
    expect(parsed).toMatchObject({ tagline: HOME_TAGLINE });
  });
});

describe("Day 1 tagline on the live homepage", () => {
  it("is in the default hero, so it shows with or without a saved homepage", async () => {
    const { DEFAULT_LANDING_SECTIONS } = await import("../defaults");
    const hero = DEFAULT_LANDING_SECTIONS.find((s) => s.type === "hero") as { tagline: string };
    expect(hero.tagline).toBe(HOME_TAGLINE);
  });
});
