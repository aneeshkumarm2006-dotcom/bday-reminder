/**
 * Number / date formatting for the hub UI. Metric-aware (percent, currency,
 * duration, position, ratio) and delta math with a "lower is better" flag for
 * cost/position metrics. Pure — used by client components. Currency defaults to
 * USD ($) since the product is US/CA-first.
 */
import type { MetricFormat } from "./metrics";

export function compactNumber(v: number): string {
  const abs = Math.abs(v);
  if (abs >= 1e9) return `${trimZero(v / 1e9)}B`;
  if (abs >= 1e6) return `${trimZero(v / 1e6)}M`;
  if (abs >= 1e4) return `${trimZero(v / 1e3)}K`;
  return Math.round(v).toLocaleString("en-US");
}

function trimZero(n: number): string {
  return n.toFixed(1).replace(/\.0$/, "");
}

export function fullNumber(v: number): string {
  return Math.round(v).toLocaleString("en-US");
}

function formatCurrency(v: number, compact: boolean): string {
  if (compact && Math.abs(v) >= 1000) return `$${compactNumber(v)}`;
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  if (m < 60) return `${m}m ${rem}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}m`;
}

/** Format a value for a metric; `compact` for headline KPIs, full for tables. */
export function formatMetricValue(
  value: number,
  format: MetricFormat,
  compact = false,
): string {
  switch (format) {
    case "percent":
      return `${(value * 100).toFixed(2)}%`;
    case "currency":
      return formatCurrency(value, compact);
    case "duration":
      return formatDuration(value);
    case "position":
      return value.toFixed(1);
    case "ratio":
      return `${value.toFixed(2)}×`;
    case "number":
    default:
      return compact ? compactNumber(value) : fullNumber(value);
  }
}

export interface Delta {
  /** Fractional change (0.12 = +12%); null when there is no baseline. */
  pct: number | null;
  direction: "up" | "down" | "flat";
}

export function computeDelta(current: number, previous: number): Delta {
  if (previous === 0) {
    if (current === 0) return { pct: 0, direction: "flat" };
    return { pct: null, direction: "up" };
  }
  const pct = (current - previous) / Math.abs(previous);
  const direction = pct > 0.0005 ? "up" : pct < -0.0005 ? "down" : "flat";
  return { pct, direction };
}

/** Format a delta as "+12.3%" / "−4.1%" / "0%" / "—" (no baseline). */
export function formatDelta(delta: Delta): string {
  if (delta.pct === null) return "—";
  const sign = delta.pct > 0 ? "+" : delta.pct < 0 ? "−" : "";
  return `${sign}${Math.abs(delta.pct * 100).toFixed(1)}%`;
}

/**
 * Whether a delta should read as "good" (green). Cost/position metrics invert:
 * a decrease is an improvement.
 */
export function isPositiveDelta(delta: Delta, lowerIsBetter = false): boolean | null {
  if (delta.direction === "flat" || delta.pct === null) return null;
  const rising = delta.direction === "up";
  return lowerIsBetter ? !rising : rising;
}

export function formatDay(iso: string, withYear = false): string {
  if (!iso) return "";
  const d = new Date(`${iso}T00:00:00.000Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: withYear ? "numeric" : undefined,
    timeZone: "UTC",
  });
}

/** Relative-ish timestamp for "last updated". */
export function formatUpdatedAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}
