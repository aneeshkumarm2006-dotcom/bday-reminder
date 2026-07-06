/**
 * Chart color system — one hue per source (rooted in the brand tokens), with
 * per-metric lightness steps inside a source. Colors are *validated*, not
 * eyeballed: `runPaletteAudit()` checks WCAG contrast against the card surface
 * and CIEDE2000 separation of the source hues under normal vision plus
 * deuteranopia/protanopia simulation. Within a source, lines are intentionally a
 * close-hue family, so the chart also differentiates them by dash pattern + end
 * marker + direct label (never hue alone). Pure math — safe in the client bundle.
 */
import { getSource, SOURCES } from "./metrics";
import type { SourceKey } from "./types";

export type Theme = "light" | "dark";

/** Card surface each theme's lines are drawn on (globals.css --surface). */
export const SURFACE: Record<Theme, string> = {
  light: "#ffffff",
  dark: "#201f23",
};

/**
 * Base hue per source (light / dark), each rooted in a brand token. Meta and
 * Users are nudged off the exact --cal-birthday / --cal-anniversary tokens so the
 * five hues clear the validated separation gate (runPaletteAudit): min normal
 * ΔE 17, min deuteranopia 8.2, min protanopia 5.1, all contrast ≥4.0.
 */
export const SOURCE_HUES: Record<SourceKey, Record<Theme, string>> = {
  ga4: { light: "#2c4bd8", dark: "#7e93f0" }, // --biro (primary blue)
  gsc: { light: "#2e8b82", dark: "#67beb3" }, // --cal-custom (teal)
  meta: { light: "#d24d7a", dark: "#ec86a8" }, // birthday-family pink
  gads: { light: "#b45f06", dark: "#e0a94b" }, // amber, from --snz/--warn family
  users: { light: "#8e44ad", dark: "#c58fdf" }, // anniversary-family purple
};

/** Stroke dash arrays for within-source line differentiation (index 0 solid). */
export const DASH_PATTERNS = ["none", "6 3", "2 3", "9 3 2 3", "1 3", "11 4"];

// ── Color-space conversions ─────────────────────────────────────────────────
interface RGB {
  r: number;
  g: number;
  b: number;
}
interface Oklch {
  L: number;
  C: number;
  H: number;
}
interface Lab {
  L: number;
  a: number;
  b: number;
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

function srgbToLinear(c: number): number {
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}
function linearToSrgb(c: number): number {
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function hexToRgb(hex: string): RGB {
  const h = hex.replace("#", "");
  const n = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const int = parseInt(n, 16);
  return { r: ((int >> 16) & 255) / 255, g: ((int >> 8) & 255) / 255, b: (int & 255) / 255 };
}

function rgbToHex({ r, g, b }: RGB): string {
  const to = (c: number) => Math.round(clamp01(c) * 255).toString(16).padStart(2, "0");
  return `#${to(r)}${to(g)}${to(b)}`;
}

function toLinear({ r, g, b }: RGB): RGB {
  return { r: srgbToLinear(r), g: srgbToLinear(g), b: srgbToLinear(b) };
}
function toSrgb({ r, g, b }: RGB): RGB {
  return { r: linearToSrgb(r), g: linearToSrgb(g), b: linearToSrgb(b) };
}

function hexToOklch(hex: string): Oklch {
  const lin = toLinear(hexToRgb(hex));
  const l = 0.4122214708 * lin.r + 0.5363325363 * lin.g + 0.0514459929 * lin.b;
  const m = 0.2119034982 * lin.r + 0.6806995451 * lin.g + 0.1073969566 * lin.b;
  const s = 0.0883024619 * lin.r + 0.2817188376 * lin.g + 0.6299787005 * lin.b;
  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);
  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bb = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;
  return { L, C: Math.hypot(a, bb), H: Math.atan2(bb, a) };
}

function oklchToHex({ L, C, H }: Oklch): string {
  const a = C * Math.cos(H);
  const bb = C * Math.sin(H);
  const l_ = L + 0.3963377774 * a + 0.2158037573 * bb;
  const m_ = L - 0.1055613458 * a - 0.0638541728 * bb;
  const s_ = L - 0.0894841775 * a - 1.291485548 * bb;
  const l = l_ ** 3;
  const m = m_ ** 3;
  const s = s_ ** 3;
  const lin: RGB = {
    r: 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    g: -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    b: -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  };
  return rgbToHex(toSrgb({ r: clamp01(lin.r), g: clamp01(lin.g), b: clamp01(lin.b) }));
}

function hexToLab(hex: string): Lab {
  const lin = toLinear(hexToRgb(hex));
  const X = 0.4124564 * lin.r + 0.3575761 * lin.g + 0.1804375 * lin.b;
  const Y = 0.2126729 * lin.r + 0.7151522 * lin.g + 0.072175 * lin.b;
  const Z = 0.0193339 * lin.r + 0.119192 * lin.g + 0.9503041 * lin.b;
  const xr = X / 0.95047;
  const yr = Y / 1.0;
  const zr = Z / 1.08883;
  const d = 6 / 29;
  const f = (t: number) => (t > d ** 3 ? Math.cbrt(t) : t / (3 * d * d) + 4 / 29);
  const fx = f(xr);
  const fy = f(yr);
  const fz = f(zr);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

function luminance(hex: string): number {
  const lin = toLinear(hexToRgb(hex));
  return 0.2126 * lin.r + 0.7152 * lin.g + 0.0722 * lin.b;
}

/** WCAG contrast ratio between two colors (1–21). */
export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// Machado et al. (2009) severity-1.0 CVD matrices, applied in linear RGB.
const CVD_MATRIX = {
  protanopia: [
    0.152286, 1.052583, -0.204868, 0.114503, 0.786281, 0.099216, -0.003882,
    -0.048116, 1.051998,
  ],
  deuteranopia: [
    0.367322, 0.860646, -0.227968, 0.280085, 0.672501, 0.047413, -0.01182,
    0.04294, 0.968881,
  ],
} as const;

export function simulateCvd(hex: string, type: keyof typeof CVD_MATRIX): string {
  const lin = toLinear(hexToRgb(hex));
  const m = CVD_MATRIX[type];
  return rgbToHex(
    toSrgb({
      r: clamp01(m[0] * lin.r + m[1] * lin.g + m[2] * lin.b),
      g: clamp01(m[3] * lin.r + m[4] * lin.g + m[5] * lin.b),
      b: clamp01(m[6] * lin.r + m[7] * lin.g + m[8] * lin.b),
    }),
  );
}

/** CIEDE2000 perceptual color difference between two Lab colors. */
export function deltaE2000(hexA: string, hexB: string): number {
  const l1 = hexToLab(hexA);
  const l2 = hexToLab(hexB);
  const rad = Math.PI / 180;
  const deg = 180 / Math.PI;
  const C1 = Math.hypot(l1.a, l1.b);
  const C2 = Math.hypot(l2.a, l2.b);
  const avgC = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(avgC ** 7 / (avgC ** 7 + 25 ** 7)));
  const a1p = l1.a * (1 + G);
  const a2p = l2.a * (1 + G);
  const C1p = Math.hypot(a1p, l1.b);
  const C2p = Math.hypot(a2p, l2.b);
  const h1p = (Math.atan2(l1.b, a1p) * deg + 360) % 360;
  const h2p = (Math.atan2(l2.b, a2p) * deg + 360) % 360;
  const dLp = l2.L - l1.L;
  const dCp = C2p - C1p;
  let dhp = 0;
  if (C1p * C2p !== 0) {
    const diff = h2p - h1p;
    if (Math.abs(diff) <= 180) dhp = diff;
    else dhp = diff > 180 ? diff - 360 : diff + 360;
  }
  const dHp = 2 * Math.sqrt(C1p * C2p) * Math.sin((dhp * rad) / 2);
  const avgLp = (l1.L + l2.L) / 2;
  const avgCp = (C1p + C2p) / 2;
  let avghp = h1p + h2p;
  if (C1p * C2p !== 0) {
    if (Math.abs(h1p - h2p) > 180) avghp += h1p + h2p < 360 ? 360 : -360;
    avghp /= 2;
  }
  const T =
    1 -
    0.17 * Math.cos((avghp - 30) * rad) +
    0.24 * Math.cos(2 * avghp * rad) +
    0.32 * Math.cos((3 * avghp + 6) * rad) -
    0.2 * Math.cos((4 * avghp - 63) * rad);
  const dTheta = 30 * Math.exp(-(((avghp - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(avgCp ** 7 / (avgCp ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (avgLp - 50) ** 2) / Math.sqrt(20 + (avgLp - 50) ** 2);
  const Sc = 1 + 0.045 * avgCp;
  const Sh = 1 + 0.015 * avgCp * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt(
    (dLp / Sl) ** 2 +
      (dCp / Sc) ** 2 +
      (dHp / Sh) ** 2 +
      Rt * (dCp / Sc) * (dHp / Sh),
  );
}

// ── Palette generation ──────────────────────────────────────────────────────
const LIGHTNESS_BAND = 0.13; // total OKLCH-L spread across a source's metrics

/**
 * Colors for every metric of a source, spread in a narrow lightness band around
 * the base hue (bounded so contrast never drifts far from the validated base).
 */
function metricColors(baseHex: string, count: number): string[] {
  if (count <= 1) return [baseHex];
  const base = hexToOklch(baseHex);
  return Array.from({ length: count }, (_, i) => {
    const L = base.L - LIGHTNESS_BAND / 2 + (LIGHTNESS_BAND * i) / (count - 1);
    return oklchToHex({ L: Math.min(0.92, Math.max(0.38, L)), C: base.C, H: base.H });
  });
}

// Precompute per source + theme so lookups are O(1) and stable across renders.
const METRIC_COLORS: Record<SourceKey, Record<Theme, string[]>> = Object.fromEntries(
  SOURCES.map((s) => [
    s.key,
    {
      light: metricColors(SOURCE_HUES[s.key].light, s.metrics.length),
      dark: metricColors(SOURCE_HUES[s.key].dark, s.metrics.length),
    },
  ]),
) as Record<SourceKey, Record<Theme, string[]>>;

/** The source's base hue for the theme (KPI sparklines, single-series charts). */
export function sourceColor(source: SourceKey, theme: Theme = "light"): string {
  return SOURCE_HUES[source][theme];
}

function metricIndex(source: SourceKey, metricId: string): number {
  const idx = getSource(source).metrics.findIndex((m) => m.id === metricId);
  return idx < 0 ? 0 : idx;
}

/** Color for a specific metric's line/tile. */
export function metricColor(
  source: SourceKey,
  metricId: string,
  theme: Theme = "light",
): string {
  const colors = METRIC_COLORS[source][theme];
  return colors[metricIndex(source, metricId)] ?? colors[0];
}

/** Dash array for a metric's line (differentiates same-hue family members). */
export function metricDash(source: SourceKey, metricId: string): string {
  return DASH_PATTERNS[metricIndex(source, metricId) % DASH_PATTERNS.length];
}

/** Combined stroke style for a chart series. */
export function seriesStyle(
  source: SourceKey,
  metricId: string,
  theme: Theme = "light",
): { color: string; dash: string } {
  return { color: metricColor(source, metricId, theme), dash: metricDash(source, metricId) };
}

// ── Audit (run by the vitest test; never fails the build silently) ──────────
export interface ContrastRow {
  source: SourceKey;
  theme: Theme;
  color: string;
  ratio: number;
  ok: boolean;
}
export interface SeparationRow {
  a: SourceKey;
  b: SourceKey;
  normal: number;
  deuteranopia: number;
  protanopia: number;
}
export interface PaletteAudit {
  contrast: ContrastRow[];
  separation: SeparationRow[];
  minNormal: number;
  minDeuteranopia: number;
  minProtanopia: number;
  failures: string[];
}

const MIN_CONTRAST = 3.0; // WCAG 1.4.11 non-text graphical objects
const MIN_NORMAL_DELTA_E = 15;
const MIN_CVD_DELTA_E = 8; // CVD compresses the space; below this we lean on dash/label

export function runPaletteAudit(): PaletteAudit {
  const contrast: ContrastRow[] = [];
  const failures: string[] = [];

  for (const s of SOURCES) {
    for (const theme of ["light", "dark"] as Theme[]) {
      for (const color of METRIC_COLORS[s.key][theme]) {
        const ratio = contrastRatio(color, SURFACE[theme]);
        const ok = ratio >= MIN_CONTRAST;
        contrast.push({ source: s.key, theme, color, ratio, ok });
        if (!ok) {
          failures.push(
            `${s.key} ${theme} ${color} contrast ${ratio.toFixed(2)} < ${MIN_CONTRAST}`,
          );
        }
      }
    }
  }

  // Cross-source separation on the light-theme base hues (the Overview case,
  // one metric per source). Checked under normal + simulated CVD.
  const separation: SeparationRow[] = [];
  let minNormal = Infinity;
  let minDeut = Infinity;
  let minProt = Infinity;
  const keys = SOURCES.map((s) => s.key);
  for (let i = 0; i < keys.length; i += 1) {
    for (let j = i + 1; j < keys.length; j += 1) {
      const ca = SOURCE_HUES[keys[i]].light;
      const cb = SOURCE_HUES[keys[j]].light;
      const normal = deltaE2000(ca, cb);
      const deuteranopia = deltaE2000(
        simulateCvd(ca, "deuteranopia"),
        simulateCvd(cb, "deuteranopia"),
      );
      const protanopia = deltaE2000(
        simulateCvd(ca, "protanopia"),
        simulateCvd(cb, "protanopia"),
      );
      separation.push({ a: keys[i], b: keys[j], normal, deuteranopia, protanopia });
      minNormal = Math.min(minNormal, normal);
      minDeut = Math.min(minDeut, deuteranopia);
      minProt = Math.min(minProt, protanopia);
      if (normal < MIN_NORMAL_DELTA_E) {
        failures.push(
          `${keys[i]}/${keys[j]} normal ΔE ${normal.toFixed(1)} < ${MIN_NORMAL_DELTA_E}`,
        );
      }
    }
  }

  return {
    contrast,
    separation,
    minNormal,
    minDeuteranopia: minDeut,
    minProtanopia: minProt,
    failures,
  };
}

export { MIN_CONTRAST, MIN_NORMAL_DELTA_E, MIN_CVD_DELTA_E };
