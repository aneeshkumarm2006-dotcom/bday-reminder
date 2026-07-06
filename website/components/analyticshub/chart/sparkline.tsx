"use client";

import { scaleLinear } from "./scale";

/** Tiny inline sparkline (no axes) for KPI cards. */
export function Sparkline({
  values,
  color,
  width = 104,
  height = 30,
  className,
}: {
  values: number[];
  color: string;
  width?: number;
  height?: number;
  className?: string;
}) {
  if (values.length < 2) {
    return <svg width={width} height={height} aria-hidden className={className} />;
  }
  const max = Math.max(...values);
  const min = Math.min(...values);
  const x = scaleLinear(0, values.length - 1, 1, width - 1);
  const y = scaleLinear(min, max === min ? min + 1 : max, height - 3, 3);
  const d = values.map((v, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(" ");
  const areaD = `${d} L${x(values.length - 1).toFixed(1)} ${height} L${x(0).toFixed(1)} ${height} Z`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      aria-hidden
      preserveAspectRatio="none"
    >
      <path d={areaD} fill={color} opacity={0.09} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
