import { Bell, PawPrint } from "lucide-react";
import Link from "next/link";

import { Ring } from "@/components/ring";
import type { UpcomingItem } from "@/lib/api";
import { countdownLabel } from "@/lib/dates";
import { occurrenceParts } from "@/lib/occurrence";

/**
 * Person / event card — the feed hero (DESIGN.md §8.1), web port of the app's
 * PersonCard. Layout: `[ Ring md ] [ name + relationship · age ] [ countdown ]`.
 * The ring (the date) leads, never a photo. Pets get a paw-print; age is omitted
 * when no birth year is known (FR-14). The whole card links to the profile.
 */
export function PersonCard({ item }: { item: UpcomingItem }) {
  const { day, month } = occurrenceParts(item.occurrenceDate);
  const isToday = item.daysRemaining === 0;

  const eventLabel =
    item.eventType === "birthday"
      ? undefined
      : item.eventType === "anniversary"
        ? "Anniversary"
        : (item.customName ?? "Event");

  const subtitle = [
    eventLabel,
    item.relationshipTag ?? undefined,
    item.ageTurning != null ? `turns ${item.ageTurning}` : undefined,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Link
      href={`/people/${item.personId}`}
      className="flex items-center gap-3 rounded-lg border border-border-subtle bg-surface p-4 transition-colors hover:bg-surface-sunken"
    >
      <Ring day={day} month={month} size="md" state={isToday ? "today" : "upcoming"} />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {item.type === "pet" && (
            <PawPrint size={16} className="shrink-0 text-ink-muted" aria-label="Pet" />
          )}
          <span className="truncate font-display font-semibold text-ink">{item.fullName}</span>
        </div>
        {subtitle && <p className="mt-0.5 truncate text-sm text-ink-muted tabular-nums">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-1 pl-2">
        {!isToday && <Bell size={16} className="text-biro" aria-hidden="true" />}
        <span className="text-sm font-medium tabular-nums text-biro">
          {countdownLabel(item.daysRemaining)}
        </span>
      </div>
    </Link>
  );
}
