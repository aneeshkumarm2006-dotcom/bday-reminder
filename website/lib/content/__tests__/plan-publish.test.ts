import { describe, expect, it } from "vitest";

import {
  HOME_PLAN_TITLE,
  migrateFamilyForPublish,
  migrateHomeTitle,
} from "../migrations/plan-publish-day1-day3";
import { familyBirthdayCalendarPage as family } from "../seo-pages/family-birthday-calendar";

describe("publish Day 1 and Day 3", () => {
  it("sets the plan's homepage title and keeps the rest", () => {
    const { next, changes } = migrateHomeTitle({ path: "/", title: "Old", description: "d" });
    expect(next).toMatchObject({ path: "/", title: HOME_PLAN_TITLE, description: "d" });
    expect(changes).toHaveLength(1);
    expect(migrateHomeTitle(next).changes).toEqual([]);
    expect(HOME_PLAN_TITLE).not.toContain("\u2014");
  });

  it("puts the plan's H1 and first sentence on the family page, once", () => {
    const { next } = migrateFamilyForPublish({
      hero: { heading: "One family birthday calendar, everyone can add to it", badge: "kept" },
    });
    const hero = next.hero as Record<string, unknown>;
    expect(hero).toMatchObject({ heading: family.hero.heading, subheading: family.hero.subheading, badge: "kept" });
    expect(String(hero.subheading)).not.toContain("\u2014");
    expect(migrateFamilyForPublish(next).changes).toEqual([]);
  });
});
