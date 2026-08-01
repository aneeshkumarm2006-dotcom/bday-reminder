import { describe, expect, it } from "vitest";

import { paginationPages } from "../blog-pagination";

describe("paginationPages", () => {
  it("lists every page while the blog is small", () => {
    expect(paginationPages(1, 3)).toEqual([1, 2, 3]);
    expect(paginationPages(3, 3)).toEqual([1, 2, 3]);
  });

  it("keeps the first and last page reachable from anywhere", () => {
    const items = paginationPages(6, 11);
    expect(items[0]).toBe(1);
    expect(items[items.length - 1]).toBe(11);
    expect(items).toEqual([1, "gap", 5, 6, 7, "gap", 11]);
  });

  it("never repeats a page or opens a gap of one", () => {
    for (let total = 1; total <= 12; total++) {
      for (let page = 1; page <= total; page++) {
        const items = paginationPages(page, total);
        const numbers = items.filter((i): i is number => i !== "gap");
        expect(new Set(numbers).size).toBe(numbers.length);
        expect([...numbers].sort((a, b) => a - b)).toEqual(numbers);
        items.forEach((item, i) => {
          if (item !== "gap") return;
          const before = items[i - 1] as number;
          const after = items[i + 1] as number;
          expect(after - before).toBeGreaterThan(1);
        });
      }
    }
  });
});
