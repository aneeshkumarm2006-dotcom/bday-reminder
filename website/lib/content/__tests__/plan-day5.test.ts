import { describe, expect, it } from "vitest";

import { DAY5_ALARM, DAY5_TRACKER } from "../migrations/plan-day5";
import { birthdayAlarmPage as alarm } from "../seo-pages/birthday-alarm";
import { birthdayTrackerPage as tracker } from "../seo-pages/birthday-tracker";

const EM_DASH = "\u2014";
const firstSentence = (text: string) => text.split(". ")[0].toLowerCase();

describe("Day 5: /birthday-alarm", () => {
  it("meets the plan", () => {
    expect(alarm.title).toBe("Birthday Alarm App: Free Birthday Alarm Reminders");
    expect(alarm.hero.heading).toBe("Birthday alarm app");
    expect(alarm.title.toLowerCase()).not.toContain("birthday reminders");
    expect(alarm.hero.heading.toLowerCase()).not.toContain("birthday reminders");
    expect(firstSentence(alarm.hero.subheading)).toContain("birthday alarm app");
    expect(alarm.faq.items.filter((i) => /birthday alarm/i.test(i.q)).length).toBeGreaterThanOrEqual(4);
  });
});

describe("Day 5: /birthday-tracker", () => {
  it("meets the plan", () => {
    expect(tracker.title).toBe("Birthday Tracker App: Free Online Birthday Tracker");
    expect(tracker.hero.heading).toBe("Birthday tracker app");
    expect(firstSentence(tracker.hero.subheading)).toContain("birthday tracker app");
    expect(tracker.faq.items.filter((i) => /birthday track/i.test(i.q)).length).toBeGreaterThanOrEqual(4);
  });
});

describe("Day 5 copy and migration", () => {
  it("adds no em dashes and keeps descriptions short", () => {
    for (const page of [alarm, tracker]) {
      for (const text of [page.title, page.description, page.hero.subheading, page.hero.tagline ?? ""]) {
        expect(text).not.toContain(EM_DASH);
      }
      expect(page.description.length).toBeLessThanOrEqual(160);
    }
  });

  it("fixes the stuffed stored copy once", () => {
    for (const day of [DAY5_ALARM, DAY5_TRACKER]) {
      const meta = day.migrateMeta({ path: day.path, title: "A | B | C | Birthday Reminders", description: "old" });
      expect(meta.next).toMatchObject(day.meta);
      expect(day.migrateMeta(meta.next).changes).toEqual([]);

      const page = day.migrateContent({ hero: { heading: "old", subheading: "old", badge: "kept" }, faq: { items: [1, 2] } });
      expect(page.next.hero).toMatchObject({ badge: "kept" });
      expect(page.next.faq).toEqual({ items: [1, 2] });
      expect(page.changes).toHaveLength(3);
      expect(day.migrateContent(page.next).changes).toEqual([]);
    }
  });
});
