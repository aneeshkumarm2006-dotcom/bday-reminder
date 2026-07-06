/**
 * Pure scale / tick / path helpers for the hand-rolled SVG charts. No chart
 * library — these are unit-tested directly.
 */

export function scaleLinear(
  domainMin: number,
  domainMax: number,
  rangeMin: number,
  rangeMax: number,
): (v: number) => number {
  const span = domainMax - domainMin || 1;
  return (v: number) => rangeMin + ((v - domainMin) / span) * (rangeMax - rangeMin);
}

/** Round a maximum up to a "nice" axis top (1/2/5 × 10^n). */
export function niceMax(max: number): number {
  if (!Number.isFinite(max) || max <= 0) return 1;
  const pow = 10 ** Math.floor(Math.log10(max));
  const n = max / pow;
  const nice = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return nice * pow;
}

/** Evenly spaced y-axis tick values from 0 to a nice max. */
export function niceTicks(max: number, count = 4): number[] {
  const top = niceMax(max);
  return Array.from({ length: count + 1 }, (_, i) => (top / count) * i);
}

/** ~`target` evenly spaced indices across `count` points (for x labels). */
export function pickXTicks(count: number, target = 6): number[] {
  if (count <= 0) return [];
  if (count <= target) return Array.from({ length: count }, (_, i) => i);
  const step = (count - 1) / (target - 1);
  return Array.from({ length: target }, (_, i) => Math.round(i * step));
}

/** SVG path "M..L.." from parallel pixel arrays. */
export function linePath(xs: number[], ys: number[]): string {
  return xs
    .map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(2)} ${ys[i].toFixed(2)}`)
    .join(" ");
}

/** Normalize a series to its own max × 100 (indexed mode). */
export function indexSeries(values: number[]): number[] {
  const max = Math.max(...values, 0);
  if (max <= 0) return values.map(() => 0);
  return values.map((v) => (v / max) * 100);
}

/** Whether indexed mode is warranted: the largest series max is >30× the smallest nonzero. */
export function needsIndexing(seriesMaxes: number[]): boolean {
  const positives = seriesMaxes.filter((m) => m > 0);
  if (positives.length < 2) return false;
  const hi = Math.max(...positives);
  const lo = Math.min(...positives);
  return lo > 0 && hi / lo > 30;
}
