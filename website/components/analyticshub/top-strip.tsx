"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";

import { Card } from "@/components/ui/card";

export interface StripItem {
  label: string;
  value: string;
}

/** Overview top-5 strip with a "view page →" link. */
export function TopStrip({
  title,
  items,
  href,
  empty,
}: {
  title: string;
  items: StripItem[];
  href?: string;
  empty?: string;
}) {
  return (
    <Card className="flex flex-col p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {href && (
          <Link
            href={href}
            className="inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-medium text-biro hover:underline"
          >
            view page
            <ArrowRight size={13} aria-hidden />
          </Link>
        )}
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-ink-muted">{empty ?? "No data yet."}</p>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 5).map((item, i) => (
            <li key={i} className="flex items-center justify-between gap-3 text-sm">
              <span className="truncate text-ink-secondary" title={item.label}>
                {item.label}
              </span>
              <span className="shrink-0 font-medium tabular-nums text-ink">{item.value}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
