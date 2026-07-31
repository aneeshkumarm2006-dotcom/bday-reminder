import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearGmailReturn,
  peekGmailReturn,
  saveGmailReturn,
  takeGmailReturn,
} from "@/lib/gmail-return";

/**
 * The parked draft decides both what a form restores and where the Gmail
 * round-trip navigates back to, so the guards here matter: expiry, one-shot
 * consumption, and rejecting anything that isn't a same-site path.
 */
describe("gmail-return", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("round-trips a parked draft", () => {
    saveGmailReturn({ returnTo: "/people/new", draft: { fullName: "Emma" } });
    expect(peekGmailReturn()).toMatchObject({
      returnTo: "/people/new",
      draft: { fullName: "Emma" },
    });
  });

  it("peek leaves the record; take consumes it", () => {
    saveGmailReturn({ returnTo: "/people/new" });
    expect(peekGmailReturn()).not.toBeNull();
    expect(peekGmailReturn()).not.toBeNull();
    expect(takeGmailReturn()).not.toBeNull();
    expect(peekGmailReturn()).toBeNull();
  });

  it("expires after 30 minutes so an abandoned connect can't resurface", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-31T10:00:00Z"));
    saveGmailReturn({ returnTo: "/people/new" });

    vi.setSystemTime(new Date("2026-07-31T10:29:00Z"));
    expect(peekGmailReturn()).not.toBeNull();

    vi.setSystemTime(new Date("2026-07-31T10:31:00Z"));
    expect(peekGmailReturn()).toBeNull();
  });

  it("rejects a return path that isn't same-site", () => {
    for (const returnTo of ["//evil.example", "https://evil.example/x", "people/new"]) {
      window.localStorage.setItem(
        "br_gmail_return",
        JSON.stringify({ returnTo, savedAt: Date.now() }),
      );
      expect(peekGmailReturn()).toBeNull();
    }
  });

  it("survives a corrupt record", () => {
    window.localStorage.setItem("br_gmail_return", "not json");
    expect(peekGmailReturn()).toBeNull();
  });

  it("clear removes the record", () => {
    saveGmailReturn({ returnTo: "/people/new" });
    clearGmailReturn();
    expect(peekGmailReturn()).toBeNull();
  });
});
