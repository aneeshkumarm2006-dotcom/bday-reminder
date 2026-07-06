"use client";

/**
 * Hand-rolled multi-line SVG chart: 2px lines, recessive grid, ~6 x-labels,
 * crosshair + tooltip showing real values, always-on legend, end-dot markers +
 * dash patterns as a non-color channel. Never a dual y-axis — pass `indexed` (or
 * let the caller detect >30× scale spread) to normalize each line to its own max.
 */
import { useLayoutEffect, useRef, useState } from "react";

import { compactNumber, formatDay, formatMetricValue } from "@/lib/analyticshub/format";
import type { MetricFormat } from "@/lib/analyticshub/metrics";

import { Legend } from "./legend";
import { indexSeries, niceMax, niceTicks, pickXTicks, scaleLinear } from "./scale";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  dash: string;
  values: number[];
  format: MetricFormat;
}

const PAD = { left: 46, right: 14, top: 10, bottom: 26 };

function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement | null>(null);
  const [width, setWidth] = useState(640);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth || 640);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width];
}

export function LineChart({
  days,
  series,
  height = 260,
  indexed = false,
}: {
  days: string[];
  series: ChartSeries[];
  height?: number;
  indexed?: boolean;
}) {
  const [ref, width] = useWidth();
  const [hover, setHover] = useState<number | null>(null);

  const innerW = Math.max(0, width - PAD.left - PAD.right);
  const innerH = Math.max(0, height - PAD.top - PAD.bottom);
  const n = days.length;
  // Clamp the hovered index to the current data (auto-clears when data changes).
  const active = hover !== null && hover >= 0 && hover < n ? hover : null;

  const display = series.map((s) => (indexed ? indexSeries(s.values) : s.values));
  const dataMax = Math.max(0, ...display.flat());
  const yMax = indexed ? 100 : niceMax(dataMax);

  const xAt = (i: number) => (n <= 1 ? PAD.left + innerW / 2 : PAD.left + (i / (n - 1)) * innerW);
  const yScale = scaleLinear(0, yMax, PAD.top + innerH, PAD.top);

  const axisFormat: MetricFormat | undefined =
    !indexed && series.length === 1 ? series[0].format : undefined;
  const yTicks = niceTicks(yMax, 4);
  const xTickIdx = pickXTicks(n, 6);

  const ariaLabel = `Line chart of ${series.map((s) => s.label).join(", ")} over ${n} days`;

  function onMove(e: React.PointerEvent<SVGSVGElement>) {
    if (n === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = e.clientX - rect.left - PAD.left;
    const idx = n <= 1 ? 0 : Math.round((rel / innerW) * (n - 1));
    setHover(Math.max(0, Math.min(n - 1, idx)));
  }

  const tooltipLeft = active === null ? 0 : Math.min(Math.max(xAt(active), 90), width - 90);

  return (
    <div className="w-full">
      <div ref={ref} className="relative w-full" style={{ height }}>
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={ariaLabel}
          className="touch-none"
          onPointerMove={onMove}
          onPointerLeave={() => setHover(null)}
        >
          {/* grid + y labels */}
          {yTicks.map((t) => (
            <g key={t}>
              <line
                x1={PAD.left}
                x2={width - PAD.right}
                y1={yScale(t)}
                y2={yScale(t)}
                className="stroke-border-subtle"
                strokeWidth={1}
              />
              <text
                x={PAD.left - 8}
                y={yScale(t)}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-ink-muted"
                style={{ fontSize: 10, fontVariantNumeric: "tabular-nums" }}
              >
                {indexed ? Math.round(t) : axisFormat ? formatMetricValue(t, axisFormat, true) : compactNumber(t)}
              </text>
            </g>
          ))}

          {/* x labels */}
          {xTickIdx.map((i) => (
            <text
              key={i}
              x={xAt(i)}
              y={height - 8}
              textAnchor="middle"
              className="fill-ink-muted"
              style={{ fontSize: 10 }}
            >
              {formatDay(days[i])}
            </text>
          ))}

          {/* crosshair */}
          {active !== null && (
            <line
              x1={xAt(active)}
              x2={xAt(active)}
              y1={PAD.top}
              y2={PAD.top + innerH}
              className="stroke-ink-muted"
              strokeWidth={1}
              strokeDasharray="3 3"
            />
          )}

          {/* series lines + end dots + hover dots */}
          {series.map((s, si) => {
            const vals = display[si];
            const d = vals
              .map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(2)} ${yScale(v).toFixed(2)}`)
              .join(" ");
            return (
              <g key={s.key}>
                <path
                  d={d}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray={s.dash === "none" ? undefined : s.dash}
                />
                {n > 0 && (
                  <circle cx={xAt(n - 1)} cy={yScale(vals[n - 1])} r={2.75} fill={s.color} />
                )}
                {active !== null && (
                  <circle
                    cx={xAt(active)}
                    cy={yScale(vals[active])}
                    r={3.5}
                    fill="var(--surface)"
                    stroke={s.color}
                    strokeWidth={2}
                  />
                )}
              </g>
            );
          })}
        </svg>

        {active !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-md border border-border-subtle bg-surface px-2.5 py-1.5 shadow-sm"
            style={{ left: tooltipLeft, top: 4 }}
          >
            <div className="mb-1 text-[11px] font-medium text-ink-secondary">
              {formatDay(days[active], true)}
            </div>
            <ul className="space-y-0.5">
              {series.map((s) => (
                <li key={s.key} className="flex items-center gap-1.5 text-[11px] text-ink">
                  <span
                    className="inline-block h-1.5 w-1.5 rounded-full"
                    style={{ backgroundColor: s.color }}
                  />
                  <span className="text-ink-secondary">{s.label}</span>
                  <span className="ml-auto pl-2 font-medium tabular-nums">
                    {formatMetricValue(s.values[active] ?? 0, s.format)}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {indexed && (
        <div className="mt-1">
          <span className="rounded-full bg-surface-sunken px-2 py-0.5 text-[10px] font-medium text-ink-muted">
            indexed · each line scaled to its own max
          </span>
        </div>
      )}

      <div className="mt-3">
        <Legend items={series.map((s) => ({ key: s.key, label: s.label, color: s.color, dash: s.dash }))} />
      </div>
    </div>
  );
}
