import { describe, expect, it } from "vitest";

import { DAY2_META, migrateDay2Meta, migrateDay2PageContent } from "../migrations/plan-day2";
import { birthdayCalendarPage as page } from "../seo-pages/birthday-calendar";

describe("Day 2: /birthday-calendar copy", () => {
  it("meets the plan", () => {
    expect(page.title).toBe("Birthday Calendar App: Free Online Birthday Reminder Calendar");
    expect(page.title).not.toMatch(/google calendar/i);
    expect(page.hero.heading).toBe("Online birthday calendar app that reminds you");
    expect(page.hero.subheading.split(". ")[0]).toMatch(/online birthday calendar/i);
    expect(page.features.heading).toBe("Sync birthdays with Google Calendar and Outlook");
    expect(page.howItWorks.heading).toBe("Birthday calendar for iPhone and Android");
    expect(page.description.length).toBeLessThanOrEqual(160);
  });

  it("adds no em dashes to the new copy", () => {
    const fresh = [
      page.title,
      page.description,
      page.hero.subheading,
      page.features.sub,
      ...page.faq.items.filter((i) => i.id === "faq-iphone-android").map((i) => i.a),
    ];
    for (const text of fresh) expect(text).not.toContain("—");
  });
});

describe("Day 2 migration", () => {
  it("replaces the stuffed meta title and is idempotent", () => {
    const { next, changes } = migrateDay2Meta({
      path: "/birthday-calendar",
      title: "Google Calendar Birthday Reminders | Digital Birthday Calendar | Birthday Reminders",
      description: "old",
      keywords: ["x"],
      canonical: "/birthday-calendar",
    });
    expect(next).toMatchObject({ canonical: "/birthday-calendar", ...DAY2_META });
    expect(changes).toHaveLength(3);
    expect(migrateDay2Meta(next).changes).toEqual([]);
  });

  it("rewrites only stored fields and appends the FAQ once", () => {
    const stored = {
      title: "Old title",
      hero: { heading: "Old H1", primaryCta: { label: "Start for free", href: "/signup" } },
      howItWorks: { heading: "Old", steps: [{ id: "step-add", title: "Add", body: "old" }] },
      faq: { items: [{ id: "faq-1", q: "Q", a: "A" }] },
    };
    const { next, changes } = migrateDay2PageContent(stored);
    const hero = next.hero as Record<string, unknown>;
    expect(next.title).toBe(page.title);
    expect(hero.heading).toBe(page.hero.heading);
    expect("subheading" in hero).toBe(false);
    expect("features" in next).toBe(false);
    expect((next.faq as { items: unknown[] }).items).toHaveLength(2);
    expect(changes.length).toBeGreaterThan(0);
    expect(migrateDay2PageContent(next).changes).toEqual([]);
  });
});
