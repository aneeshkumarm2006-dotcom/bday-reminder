"use client";

export interface LegendItem {
  key: string;
  label: string;
  color: string;
  dash: string;
}

/** Always-on chart legend with a line swatch (color + dash) per series. */
export function Legend({ items }: { items: LegendItem[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
      {items.map((item) => (
        <li key={item.key} className="flex items-center gap-1.5 text-xs text-ink-secondary">
          <svg width={18} height={8} viewBox="0 0 18 8" aria-hidden className="shrink-0">
            <line
              x1={0}
              y1={4}
              x2={18}
              y2={4}
              stroke={item.color}
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeDasharray={item.dash === "none" ? undefined : item.dash}
            />
          </svg>
          {item.label}
        </li>
      ))}
    </ul>
  );
}
