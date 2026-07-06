import { describe, expect, it } from "vitest";

import {
  MIN_CONTRAST,
  MIN_CVD_DELTA_E,
  MIN_NORMAL_DELTA_E,
  metricColor,
  runPaletteAudit,
  sourceColor,
} from "@/lib/analyticshub/colors";

describe("chart palette (validated, not eyeballed)", () => {
  const audit = runPaletteAudit();

  it("has no failures", () => {
    expect(audit.failures).toEqual([]);
  });

  it("meets the WCAG contrast floor for every color in both themes", () => {
    for (const row of audit.contrast) {
      expect(row.ratio).toBeGreaterThanOrEqual(MIN_CONTRAST);
    }
  });

  it("separates the five source hues under normal vision", () => {
    expect(audit.minNormal).toBeGreaterThanOrEqual(MIN_NORMAL_DELTA_E);
  });

  it("keeps a usable separation under simulated color-vision deficiency", () => {
    // Below this the chart also uses dash + end markers + labels (non-color).
    expect(audit.minDeuteranopia).toBeGreaterThanOrEqual(MIN_CVD_DELTA_E);
    expect(audit.minProtanopia).toBeGreaterThan(0);
  });

  it("returns stable hex colors", () => {
    expect(sourceColor("ga4", "light")).toMatch(/^#[0-9a-f]{6}$/);
    expect(metricColor("ga4", "sessions", "dark")).toMatch(/^#[0-9a-f]{6}$/);
  });
});
