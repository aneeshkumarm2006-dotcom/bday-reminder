import { describe, expect, it } from "vitest";

import { getSeoLandingPage } from "../seo-pages";
import {
  FAMILY_MONTH_LIST_HEADING,
  familyBirthdayCalendarPage as page,
} from "../seo-pages/family-birthday-calendar";
import { DAY3_META, migrateDay3Meta, migrateDay3PageContent } from "../migrations/plan-day3";

type Group = { kind: string; heading: string; blocks: Record<string, unknown>[] };

describe("Day 3: /family-birthday-calendar copy", () => {
  it("meets the plan", () => {
    expect(page.title).toBe("Family Birthday Calendar & List: Shared Birthday Reminders");
    expect(page.title.length).toBeLessThanOrEqual(60);
    expect(page.description.length).toBeLessThanOrEqual(160);
    expect(page.hero.heading).toBe("Family birthday calendar and birthdays list");
    expect(page.hero.subheading).toMatch(/family birthdays list/);
    expect(page.hero.subheading).not.toContain("—");
  });

  it("puts the month list with a 12-row table right under the hero", () => {
    const def = getSeoLandingPage("family-birthday-calendar")!;
    const group = def.layout[1] as unknown as Group;
    expect(def.layout[0]).toMatchObject({ kind: "section", section: "hero" });
    expect(group.heading).toBe(FAMILY_MONTH_LIST_HEADING);
    const table = group.blocks[0] as { rows: { cells: string[] }[] };
    expect(table.rows).toHaveLength(12);
    expect(table.rows[0].cells[0]).toBe("January");
    expect(table.rows[11].cells[0]).toBe("December");
  });
});

describe("Day 3 migration", () => {
  it("fixes the meta and is idempotent", () => {
    const { next, changes } = migrateDay3Meta({
      path: "/family-birthday-calendar",
      title: "Family Birthday Calendar | Calendar With Family Birthdays | Birthday Reminders",
      description: "old",
    });
    expect(next).toMatchObject(DAY3_META);
    expect(changes).toHaveLength(3);
    expect(migrateDay3Meta(next).changes).toEqual([]);
  });

  it("fills the empty table the team added, keeps their copy, and adds the tips and FAQ", () => {
    const stored = {
      hero: { heading: "Family birthday calendar and birthdays list" },
      layout: [
        { id: "slot-hero", kind: "section", section: "hero", visible: true },
        {
          id: "group-abc",
          kind: "blocks",
          visible: true,
          heading: FAMILY_MONTH_LIST_HEADING,
          sub: "Their own sub-heading",
          background: "none",
          blocks: [{ id: "block-xyz", type: "comparisonTable", heading: "", columns: [], rows: [] }],
        },
        { id: "slot-faq", kind: "section", section: "faq", visible: true },
      ],
      faq: { items: [{ id: "faq-1", q: "Q", a: "A" }] },
    };
    const { next, changes } = migrateDay3PageContent(stored);
    const group = (next.layout as unknown[])[1] as Group & { sub: string };
    expect(group.sub).toBe("Their own sub-heading");
    expect(group.blocks[0]).toMatchObject({ id: "block-xyz", type: "comparisonTable" });
    expect((group.blocks[0].rows as unknown[]).length).toBe(12);
    expect(group.blocks[1]).toMatchObject({ type: "richText" });
    expect((next.faq as { items: unknown[] }).items).toHaveLength(2);
    expect(changes).toHaveLength(3);
    expect(migrateDay3PageContent(next).changes).toEqual([]);
  });

  it("adds the section under the hero when the layout doesn't have it", () => {
    const { next } = migrateDay3PageContent({
      layout: [
        { id: "slot-hero", kind: "section", section: "hero", visible: true },
        { id: "slot-faq", kind: "section", section: "faq", visible: true },
      ],
    });
    const layout = next.layout as Group[];
    expect(layout).toHaveLength(3);
    expect(layout[1].heading).toBe(FAMILY_MONTH_LIST_HEADING);
  });

  it("leaves a table that already has rows alone", () => {
    const own = { id: "t", type: "comparisonTable", heading: "", columns: ["A"], rows: [{ id: "r", cells: ["x"] }] };
    const { next } = migrateDay3PageContent({
      layout: [{ id: "g", kind: "blocks", heading: FAMILY_MONTH_LIST_HEADING, sub: "s", blocks: [own] }],
    });
    expect(((next.layout as Group[])[0].blocks[0])).toEqual(own);
  });
});
