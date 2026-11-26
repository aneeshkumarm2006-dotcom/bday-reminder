import { describe, expect, it } from "vitest";

import { getSeoLandingPage } from "../seo-pages";
import { birthdayCountdownAppPage as page } from "../seo-pages/birthday-countdown-app";
import { DAY4_META, migrateDay4Meta, migrateDay4PageContent } from "../migrations/plan-day4";
import { seoPageContentSchema } from "../validation";

const EM_DASH = "\u2014";

describe("Day 4: /birthday-countdown-app copy", () => {
  it("meets the plan", () => {
    expect(page.title).toBe("Birthday Countdown App: Free Countdown + Widget (iPhone & Android)");
    expect(page.description.length).toBeLessThanOrEqual(160);
    expect(page.hero.heading).toBe("Birthday countdown app");
    expect(page.hero.tagline).toBe("A birthday countdown app that does something when it hits zero");
    expect(page.hero.subheading.split(". ")[0]).toMatch(/birthday countdown app/);
    for (const item of page.faq.items) expect(item.a).not.toMatch(/days, hours/i);
  });

  it("has the widget H2 right after the features, and no new em dashes", () => {
    const def = getSeoLandingPage("birthday-countdown-app")!;
    const at = def.layout.findIndex((it) => "section" in it && it.section === "features");
    expect(def.layout[at + 1]).toMatchObject({ kind: "blocks", heading: "Birthday countdown widget" });
    const fresh = [page.title, page.description, page.hero.subheading, page.hero.tagline ?? ""];
    for (const text of fresh) expect(text).not.toContain(EM_DASH);
  });
});

describe("Day 4 migration", () => {
  it("replaces the stuffed meta and is idempotent", () => {
    const { next, changes } = migrateDay4Meta({
      path: "/birthday-countdown-app",
      title: "Birthday Countdown App | Birthday Countdown Online | Countdown Birthday App | Birthday Reminders",
      description: "old",
      keywords: ["x"],
    });
    expect(next).toMatchObject(DAY4_META);
    expect(changes).toHaveLength(3);
    expect(migrateDay4Meta(next).changes).toEqual([]);
  });

  it("fixes the hero, the hours FAQ and adds the widget H2 once", () => {
    const stored = {
      hero: { heading: "A birthday countdown app that does something when it hits zero", subheading: "old" },
      faq: {
        items: [
          { id: "faq-1", q: "What is it?", a: "Days left." },
          { id: "x", q: "How accurate is a birthday countdown app?", a: "Shows days, hours, minutes, and seconds" },
        ],
      },
      layout: [
        { id: "slot-hero", kind: "section", section: "hero", visible: true },
        { id: "slot-features", kind: "section", section: "features", visible: true },
        { id: "slot-faq", kind: "section", section: "faq", visible: true },
      ],
    };
    const { next } = migrateDay4PageContent(stored);
    const hero = next.hero as Record<string, string>;
    expect(hero.heading).toBe("Birthday countdown app");
    expect(hero.tagline).toBe(page.hero.tagline);
    const items = (next.faq as { items: { a: string }[] }).items;
    expect(items[0].a).toBe("Days left.");
    expect(items[1].a).not.toMatch(/days, hours/);
    expect((next.layout as { heading?: string }[])[2].heading).toBe("Birthday countdown widget");
    expect(migrateDay4PageContent(next).changes).toEqual([]);
    expect(seoPageContentSchema.safeParse({ hero: { tagline: page.hero.tagline } }).success).toBe(true);
  });
});
