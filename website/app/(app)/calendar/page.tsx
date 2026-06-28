"use client";

import { useQuery } from "@tanstack/react-query";
import { CalendarPlus, PawPrint, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { CalendarAgenda } from "@/components/app/calendar-agenda";
import { CalendarGrid, CalendarLegend, eventDayInMonth } from "@/components/app/calendar-grid";
import { CalendarMonthPicker } from "@/components/app/calendar-month-picker";
import { CalendarNav, type CalendarMode } from "@/components/app/calendar-nav";
import { PageHeader } from "@/components/app/page-header";
import { buttonVariants } from "@/components/ui/button";
import { LoadingBlock } from "@/components/ui/spinner";
import { calendarEventsApi } from "@/lib/api";
import { monthAbbr } from "@/lib/dates";
import { eventTypeMeta } from "@/lib/event-style";
import { cn } from "@/lib/utils";

/**
 * Calendar — a month-grid (or list) view of every event (birthday, anniversary,
 * custom) on its date, colored by type, where tapping a day shows who's on it and
 * lets you add a birthday on that date (prefilled). A Month/List toggle, a "Today"
 * jump and a month/year picker make it quick to move around. The Upcoming feed
 * moved into Reminders; this is the browse-and-add surface.
 *
 * Data is `GET /calendar/events` (raw month/day per event) so the grid can page
 * to any month. "Today" comes from the server (timezone-anchored), never the
 * browser clock, to match how reminders are scheduled.
 */

/** Parse a UTC-midnight ISO date into calendar y/m/d (read from the prefix). */
function ymd(iso: string): { year: number; month: number; day: number } {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  const d = new Date(iso);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

/** Shift a {year, month} by whole months, rolling the year over. */
function shiftMonth(c: { year: number; month: number }, delta: number) {
  const zero = c.month - 1 + delta;
  return { year: c.year + Math.floor(zero / 12), month: ((zero % 12) + 12) % 12 + 1 };
}

export default function CalendarPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["calendar-events"],
    queryFn: () => calendarEventsApi.list(),
  });

  // null until first data arrives, then anchored to today's month / day.
  const [view, setView] = useState<{ year: number; month: number } | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [anchored, setAnchored] = useState(false);
  const [mode, setMode] = useState<CalendarMode>("month");
  const [pickerOpen, setPickerOpen] = useState(false);

  if (isLoading) return <LoadingBlock />;
  if (isError || !data) {
    return <p className="text-ink-secondary">Couldn&apos;t load your calendar. Refresh to try again.</p>;
  }

  const today = ymd(data.today);
  // First render after data: anchor the grid to today's month and preselect it.
  if (!anchored) {
    setView({ year: today.year, month: today.month });
    setSelectedDay(today.day);
    setAnchored(true);
  }
  const shown = view ?? { year: today.year, month: today.month };

  const goMonth = (delta: number) => {
    setView((c) => shiftMonth(c ?? shown, delta));
    setSelectedDay(null); // a new month: clear the selection until the user clicks.
  };

  const goToday = () => {
    setView({ year: today.year, month: today.month });
    setSelectedDay(today.day);
  };

  const pickMonth = (next: { year: number; month: number }) => {
    setView(next);
    setSelectedDay(null);
    setPickerOpen(false);
  };

  const dayEvents =
    selectedDay != null
      ? data.events.filter((ev) => eventDayInMonth(ev, shown.year, shown.month) === selectedDay)
      : [];

  return (
    <div>
      <PageHeader
        title="Calendar"
        action={
          <Link href="/people/new" className={cn(buttonVariants(), "hidden sm:inline-flex")}>
            <Plus aria-hidden="true" />
            Add person
          </Link>
        }
      />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="max-w-xl">
          <CalendarNav
            year={shown.year}
            month={shown.month}
            mode={mode}
            onModeChange={setMode}
            onPrev={() => goMonth(-1)}
            onNext={() => goMonth(1)}
            onToday={goToday}
            onOpenPicker={() => setPickerOpen(true)}
          />

          {mode === "list" ? (
            <CalendarAgenda year={shown.year} month={shown.month} events={data.events} today={today} />
          ) : (
            <>
              <CalendarGrid
                year={shown.year}
                month={shown.month}
                events={data.events}
                today={today}
                selectedDay={selectedDay}
                onSelectDay={setSelectedDay}
              />
              <CalendarLegend />
            </>
          )}
        </div>

        {mode === "month" && (
          <div>
            {selectedDay != null ? (
              <div className="flex flex-col gap-3">
                <h2 className="font-display text-lg font-semibold text-ink">
                  {`${monthAbbr(shown.month)} ${selectedDay}`}
                </h2>

                {dayEvents.length === 0 ? (
                  <p className="text-sm text-ink-secondary">No one on this day yet.</p>
                ) : (
                  <div className="flex flex-col gap-2">
                    {dayEvents.map((ev) => (
                      <Link
                        key={ev.eventId}
                        href={`/people/${ev.personId}`}
                        className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface p-3 transition-colors hover:bg-surface-sunken"
                      >
                        {ev.type === "pet" && (
                          <PawPrint size={16} className="shrink-0 text-ink-muted" aria-label="Pet" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-display font-semibold text-ink">{ev.fullName}</p>
                          <p className="mt-0.5 truncate text-sm text-ink-muted">
                            {[eventTypeMeta(ev).label, ev.relationshipTag ?? undefined]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                )}

                <Link
                  href={`/people/new?month=${shown.month}&day=${selectedDay}`}
                  className={cn(buttonVariants({ variant: "secondary" }), "w-full")}
                >
                  <CalendarPlus aria-hidden="true" />
                  {`Add birthday on ${monthAbbr(shown.month)} ${selectedDay}`}
                </Link>
              </div>
            ) : (
              <p className="text-sm text-ink-muted">
                Select a day to see who&apos;s on it or add a birthday.
              </p>
            )}
          </div>
        )}
      </div>

      <CalendarMonthPicker
        open={pickerOpen}
        year={shown.year}
        month={shown.month}
        onClose={() => setPickerOpen(false)}
        onPick={pickMonth}
      />
    </div>
  );
}
