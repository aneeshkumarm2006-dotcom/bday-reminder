import { describe, expect, it } from "vitest";

import { readNextParam, safeNextPath, withNext } from "../next-path";

/**
 * `?next=` decides a navigation after sign-in, so it only ever holds a same-site
 * absolute path. The open-redirect shapes ("//evil.com", "https://evil.com") are
 * the ones worth pinning; the rest covers the invite case the param exists for.
 */
describe("safeNextPath", () => {
  it("accepts a same-site absolute path", () => {
    expect(safeNextPath("/invite/abc123")).toBe("/invite/abc123");
  });

  it("rejects a protocol-relative URL", () => {
    expect(safeNextPath("//evil.com/steal")).toBeNull();
  });

  it("rejects an absolute URL", () => {
    expect(safeNextPath("https://evil.com/steal")).toBeNull();
  });

  it("rejects a relative path and empty input", () => {
    expect(safeNextPath("invite/abc")).toBeNull();
    expect(safeNextPath("")).toBeNull();
    expect(safeNextPath(null)).toBeNull();
  });
});

describe("withNext", () => {
  it("appends an encoded next param", () => {
    expect(withNext("/login", "/invite/abc123")).toBe("/login?next=%2Finvite%2Fabc123");
  });

  it("leaves the target alone when there is nothing to carry", () => {
    expect(withNext("/login", null)).toBe("/login");
    expect(withNext("/login", "https://evil.com")).toBe("/login");
  });

  it("round-trips through readNextParam", () => {
    const url = withNext("/login", "/invite/abc123");
    expect(readNextParam(url.slice(url.indexOf("?")))).toBe("/invite/abc123");
  });
});
