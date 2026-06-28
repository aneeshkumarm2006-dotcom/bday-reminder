"use client";

import { PawPrint } from "lucide-react";
import Link from "next/link";

import { eventDayInMonth } from "@/components/app/calendar-grid";
import type { CalendarEvent } from "@/lib/api";
import { monthAbbr } from "@/lib/dates";
import { eventTypeMeta } from "@/lib/event-style";
import { cn } from "@/lib/utils";

/**
 * The agenda (list) view of the calendar: the displayed month's events in date
 * order, one row each, easier to skim than clicking day by day. Clicking a row
 * opens that person. Same data and Feb-29 placement as the grid (via
 * eventDayInMonth), just laid out as a list. Web port of the app's agenda.
 */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export function CalendarAgenda({
  year,
  month,
  events,
  today,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  today: { year: number; month: number; day: number };
}) {
  const isCurrentMonth = today.year === year && today.month === month;

  // Resolve each event to its day this month, drop the ones that don't appear,
  // then sort by day and name so the list reads top-to-bottom through the month.
  const rows = events
    .map((ev) => ({ ev, day: eventDayInMonth(ev, year, month) }))
    .filter((r): r is { ev: CalendarEvent; day: number } => r.day != null)
    .sort((a, b) => a.day - b.day || a.ev.fullName.localeCompare(b.ev.fullName));

  if (rows.length === 0) {
    return (
      <p className="mt-6 text-center text-sm text-ink-secondary">
        {`No events in ${MONTH_NAMES[month - 1]}.`}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {rows.map(({ ev, day }) => {
        const meta = eventTypeMeta(ev);
        const Icon = meta.Icon;
        const isToday = isCurrentMonth && today.day === day;
        const sub = [meta.label, ev.relationshipTag ?? undefined].filter(Boolean).join(" · ");
        return (
          <Link
            key={ev.eventId}
            href={`/people/${ev.personId}`}
            className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-3 transition-colors hover:bg-surface-sunken"
          >
            {/* Date badge */}
            <div
              className={cn(
                "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-md",
                isToday ? "bg-biro text-paper" : "bg-surface-sunken text-ink",
              )}
            >
              <span className="text-base font-semibold leading-none tabular-nums">{day}</span>
              <span className={cn("mt-0.5 text-[10px] leading-none", isToday ? "text-paper" : "text-ink-muted")}>
                {monthAbbr(month)}
              </span>
            </div>

            <Icon size={16} className={cn("shrink-0", meta.textClass)} aria-label={meta.label} />

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                {ev.type === "pet" && (
                  <PawPrint size={14} className="shrink-0 text-ink-muted" aria-label="Pet" />
                )}
                <p className="truncate font-display font-semibold text-ink">{ev.fullName}</p>
              </div>
              {sub && <p className="mt-0.5 truncate text-sm text-ink-muted">{sub}</p>}
            </div>
          </Link>
        );
      })}
    </div>
  );
}
