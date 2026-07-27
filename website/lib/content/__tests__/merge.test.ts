import { describe, expect, it } from "vitest";

import { DEFAULT_LANDING, DEFAULT_NAV, DEFAULT_SETTINGS, SECTION_TEMPLATES } from "../defaults";
import { deepMerge, mergeById } from "../merge";
import type { LandingSection, SectionType } from "../types";

/**
 * These are the regression tests that matter most: the public site must render
 * correctly against an empty, partial, or corrupt database. Everything else in
 * the admin can fail loudly; this layer has to fail silently and safely.
 */
describe("deepMerge", () => {
  it("returns the defaults for an empty document", () => {
    expect(deepMerge(DEFAULT_SETTINGS, {})).toEqual(DEFAULT_SETTINGS);
  });

  it("returns the defaults for null and undefined", () => {
    expect(deepMerge(DEFAULT_SETTINGS, null)).toEqual(DEFAULT_SETTINGS);
    expect(deepMerge(DEFAULT_SETTINGS, undefined)).toEqual(DEFAULT_SETTINGS);
  });

  it("applies a partial override without blanking its siblings", () => {
    const merged = deepMerge(DEFAULT_SETTINGS, {
      identity: { name: "New name" },
    });
    expect(merged.identity.name).toBe("New name");
    expect(merged.identity.tagline).toBe(DEFAULT_SETTINGS.identity.tagline);
    expect(merged.seo.titleTemplate).toBe(DEFAULT_SETTINGS.seo.titleTemplate);
  });

  it("falls back on empty and whitespace-only strings — that's the reset button", () => {
    const merged = deepMerge(DEFAULT_SETTINGS, {
      identity: { name: "", tagline: "   " },
    });
    expect(merged.identity.name).toBe(DEFAULT_SETTINGS.identity.name);
    expect(merged.identity.tagline).toBe(DEFAULT_SETTINGS.identity.tagline);
  });

  it("honours boolean false so a section can actually be switched off", () => {
    const merged = deepMerge(DEFAULT_SETTINGS, {
      seo: { indexingEnabled: false },
    });
    expect(merged.seo.indexingEnabled).toBe(false);
  });

  it("honours an empty array so every keyword can be removed", () => {
    const merged = deepMerge(DEFAULT_SETTINGS, { seo: { keywords: [] } });
    expect(merged.seo.keywords).toEqual([]);
  });

  it("ignores a non-array where an array is expected", () => {
    const merged = deepMerge(DEFAULT_SETTINGS, { seo: { keywords: "oops" } });
    expect(merged.seo.keywords).toEqual(DEFAULT_SETTINGS.seo.keywords);
  });

  it("ignores wrong-typed scalars", () => {
    const merged = deepMerge(DEFAULT_SETTINGS, {
      identity: { name: 42 },
      seo: { indexingEnabled: "yes" },
    });
    expect(merged.identity.name).toBe(DEFAULT_SETTINGS.identity.name);
    expect(merged.seo.indexingEnabled).toBe(true);
  });

  it("drops unknown keys — the defaults are the whitelist", () => {
    const merged = deepMerge(DEFAULT_SETTINGS, {
      identity: { name: "Kept", evil: "<script>" },
      somethingElse: true,
    }) as unknown as Record<string, unknown>;
    expect(merged.somethingElse).toBeUndefined();
    expect((merged.identity as Record<string, unknown>).evil).toBeUndefined();
  });

  it("survives complete garbage", () => {
    expect(deepMerge(DEFAULT_NAV, "nonsense")).toEqual(DEFAULT_NAV);
    expect(deepMerge(DEFAULT_NAV, 12)).toEqual(DEFAULT_NAV);
    expect(deepMerge(DEFAULT_NAV, [1, 2, 3])).toEqual(DEFAULT_NAV);
  });

  it("accepts a value for a nullable field whose default is null", () => {
    const merged = deepMerge(DEFAULT_SETTINGS, {
      announcement: { startAt: "2026-08-01T09:00:00.000Z" },
    });
    expect(merged.announcement.startAt).toBe("2026-08-01T09:00:00.000Z");
  });
});

describe("mergeById", () => {
  const template = (item: Record<string, unknown>): LandingSection | null => {
    const type = item.type as SectionType | undefined;
    return type && type in SECTION_TEMPLATES ? SECTION_TEMPLATES[type] : null;
  };

  it("falls back to the defaults for a non-array", () => {
    expect(mergeById(DEFAULT_LANDING.sections, null, template)).toEqual(
      DEFAULT_LANDING.sections,
    );
    expect(mergeById(DEFAULT_LANDING.sections, {}, template)).toEqual(
      DEFAULT_LANDING.sections,
    );
  });

  it("keeps the stored order", () => {
    const reordered = [{ id: "faq", type: "faq" }, { id: "hero", type: "hero" }];
    const merged = mergeById(DEFAULT_LANDING.sections, reordered, template);
    expect(merged.map((s) => s.id)).toEqual(["faq", "hero"]);
  });

  it("fills a partial section from the default with the same id", () => {
    const merged = mergeById(
      DEFAULT_LANDING.sections,
      [{ id: "hero", type: "hero", heading: "Rewritten" }],
      template,
    );
    const hero = merged[0];
    expect(hero.type).toBe("hero");
    expect(hero.id).toBe("hero");
    if (hero.type !== "hero") throw new Error("expected the hero section");
    expect(hero.heading).toBe("Rewritten");
    // Untouched fields still come from the built-in copy.
    expect(hero.footnote).toBe("Free on web, iOS, and Android. No ads, no paid tier.");
  });

  it("honours visible:false rather than treating it as unset", () => {
    const merged = mergeById(
      DEFAULT_LANDING.sections,
      [{ id: "faq", type: "faq", visible: false }],
      template,
    );
    expect(merged[0].visible).toBe(false);
  });

  it("drops items whose type isn't known", () => {
    const merged = mergeById(
      DEFAULT_LANDING.sections,
      [{ id: "hero", type: "hero" }, { id: "mystery", type: "wat" }],
      template,
    );
    expect(merged).toHaveLength(1);
  });

  it("uses the type template for a section id the defaults don't have", () => {
    const merged = mergeById(
      DEFAULT_LANDING.sections,
      [{ id: "extra-faq", type: "faq", heading: "More questions" }],
      template,
    );
    expect(merged[0].id).toBe("extra-faq");
    if (merged[0].type !== "faq") throw new Error("expected the faq section");
    expect(merged[0].heading).toBe("More questions");
    expect(merged[0].items).toEqual([]);
  });

  it("falls back to the defaults when nothing usable survives", () => {
    const merged = mergeById(
      DEFAULT_LANDING.sections,
      [{ type: "nope" }, "garbage"],
      template,
    );
    expect(merged).toEqual(DEFAULT_LANDING.sections);
  });
});
