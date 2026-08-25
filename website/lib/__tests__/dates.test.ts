import { describe, expect, it } from "vitest";

import { isMilestoneYear, ordinalYear } from "@/lib/dates";

/**
 * The milestone rule, mirrored from `backend/src/lib/dates.ts`. The server sends
 * `isMilestone` on every feed row, so the copy here exists for the surfaces that
 * count a year locally — the calendar grid pages to arbitrary years and has no
 * server-side count to read. A drift between the two would show a "25th" pill on
 * the grid and nothing in the feed for the same date, so the rule is asserted on
 * both sides rather than trusted to stay in sync.
 */
describe("website dates: milestone years", () => {
  it("flags multiples of five from the 5th up, and nothing between them", () => {
    for (const years of [5, 10, 25, 50, 100]) {
      expect(isMilestoneYear(years), String(years)).toBe(true);
    }
    for (const years of [0, 1, 4, 6, 24, 26, 49]) {
      expect(isMilestoneYear(years), String(years)).toBe(false);
    }
  });

  it("is false without a year, so a dateless event is never a milestone", () => {
    expect(isMilestoneYear(null)).toBe(false);
    expect(isMilestoneYear(undefined)).toBe(false);
  });

  it("ordinalYear gets the suffixes right, teens included", () => {
    expect(ordinalYear(1)).toBe("1st");
    expect(ordinalYear(2)).toBe("2nd");
    expect(ordinalYear(3)).toBe("3rd");
    expect(ordinalYear(11)).toBe("11th");
    expect(ordinalYear(12)).toBe("12th");
    expect(ordinalYear(13)).toBe("13th");
    expect(ordinalYear(25)).toBe("25th");
    expect(ordinalYear(121)).toBe("121st");
  });
});
