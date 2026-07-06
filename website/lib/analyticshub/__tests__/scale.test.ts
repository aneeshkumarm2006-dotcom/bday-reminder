import { describe, expect, it } from "vitest";

import {
  indexSeries,
  linePath,
  needsIndexing,
  niceMax,
  niceTicks,
  pickXTicks,
  scaleLinear,
} from "@/components/analyticshub/chart/scale";

describe("chart scale helpers", () => {
  it("rounds up to a nice axis max", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(10)).toBe(10);
    expect(niceMax(11)).toBe(20);
    expect(niceMax(50)).toBe(50);
    expect(niceMax(51)).toBe(100);
  });

  it("builds evenly spaced ticks from 0", () => {
    expect(niceTicks(100, 4)).toEqual([0, 25, 50, 75, 100]);
  });

  it("maps a domain to a range", () => {
    const s = scaleLinear(0, 10, 0, 100);
    expect(s(5)).toBe(50);
  });

  it("builds an SVG path", () => {
    expect(linePath([0, 10], [5, 15])).toBe("M0.00 5.00 L10.00 15.00");
  });

  it("indexes a series to its own max × 100", () => {
    expect(indexSeries([2, 4, 0])).toEqual([50, 100, 0]);
  });

  it("detects when indexing is warranted (>30× spread)", () => {
    expect(needsIndexing([100, 2])).toBe(true);
    expect(needsIndexing([100, 50])).toBe(false);
    expect(needsIndexing([100])).toBe(false);
  });

  it("picks ~6 x-tick indices", () => {
    expect(pickXTicks(3)).toEqual([0, 1, 2]);
    expect(pickXTicks(30, 6)).toHaveLength(6);
  });
});
