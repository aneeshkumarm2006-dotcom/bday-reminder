import { describe, expect, it } from "vitest";

import {
  addDays,
  dayCount,
  enumerateDays,
  previousRange,
  resolveRange,
  safeRange,
  zeroFillSeries,
} from "@/lib/analyticshub/dates";

const NOW = new Date("2026-07-06T12:00:00.000Z");

describe("dates", () => {
  it("adds days across month boundaries", () => {
    expect(addDays("2026-06-30", 1)).toBe("2026-07-01");
    expect(addDays("2026-07-01", -1)).toBe("2026-06-30");
  });

  it("counts inclusive days", () => {
    expect(dayCount({ from: "2026-07-01", to: "2026-07-07" })).toBe(7);
    expect(dayCount({ from: "2026-07-01", to: "2026-07-01" })).toBe(1);
  });

  it("resolves the 7-day preset anchored to now", () => {
    expect(resolveRange("7d", NOW)).toEqual({ from: "2026-06-30", to: "2026-07-06" });
    expect(resolveRange("yesterday", NOW)).toEqual({ from: "2026-07-05", to: "2026-07-05" });
  });

  it("computes the immediately-preceding equal-length range", () => {
    expect(previousRange({ from: "2026-06-30", to: "2026-07-06" })).toEqual({
      from: "2026-06-23",
      to: "2026-06-29",
    });
  });

  it("enumerates every day inclusive", () => {
    expect(enumerateDays({ from: "2026-07-01", to: "2026-07-03" })).toEqual([
      "2026-07-01",
      "2026-07-02",
      "2026-07-03",
    ]);
  });

  it("zero-fills a sparse series", () => {
    const series = zeroFillSeries(
      "users",
      "signups",
      { from: "2026-07-01", to: "2026-07-03" },
      new Map([["2026-07-02", 5]]),
    );
    expect(series.map((p) => p.value)).toEqual([0, 5, 0]);
    expect(series.every((p) => p.source === "users" && p.metric === "signups")).toBe(true);
  });

  it("sanitizes a bad range to the default preset", () => {
    const r = safeRange("nonsense", null);
    expect(dayCount(r)).toBe(7);
  });

  it("swaps a reversed range", () => {
    expect(safeRange("2026-07-06", "2026-07-01")).toEqual({ from: "2026-07-01", to: "2026-07-06" });
  });
});
