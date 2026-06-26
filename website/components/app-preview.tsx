import { Bell, MessageCircle, PawPrint } from "lucide-react";

import { Ring, type RingState } from "@/components/ring";
import { cn } from "@/lib/utils";

/**
 * On-brand "screenshots" of the app, rendered from the same design system
 * (DESIGN.md §8.1/§8.3/§8.13) rather than raster images - so they stay crisp,
 * themeable (light/dark), and always match the real UI. The ring leads each
 * row; photos never crowd the feed (§2 date-led).
 */

function MockPersonCard({
  day,
  month,
  state = "upcoming",
  name,
  sub,
  count,
  today = false,
  pet = false,
}: {
  day: number;
  month: string;
  state?: RingState;
  name: string;
  sub: string;
  count: string;
  today?: boolean;
  pet?: boolean;
}) {
  return (
    <div className="flex items-center gap-3.5 rounded-lg border border-border-subtle bg-surface p-4">
      <Ring day={day} month={month} size="md" state={state} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {pet ? (
            <PawPrint size={15} className="shrink-0 text-ink-secondary" aria-hidden="true" />
          ) : null}
          <span className="truncate font-display text-[15px] font-semibold text-ink">
            {name}
          </span>
        </div>
        <span className="text-xs text-ink-muted">{sub}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        {!today ? <Bell size={14} className="text-biro" aria-hidden="true" /> : null}
        <span className="text-xs font-medium tabular-nums text-biro">{count}</span>
      </div>
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-sm bg-surface-sunken px-3 py-1.5">
      <span className="font-display text-sm font-semibold text-ink">{children}</span>
    </div>
  );
}

/** The Upcoming feed - grouped + sorted, the ring leading each row (§8.2). */
export function AppPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-2xl border border-border-subtle bg-paper p-4 shadow-[0_1px_2px_rgba(35,32,32,0.05),0_18px_48px_-12px_rgba(35,32,32,0.18)]",
        className,
      )}
      role="img"
      aria-label="A preview of the Upcoming feed in the app"
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="font-display text-xl font-semibold tracking-[-0.01em] text-ink">
          Upcoming
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <SectionLabel>This week</SectionLabel>
        <MockPersonCard
          day={12}
          month="Jun"
          state="today"
          today
          name="Michael Brooks"
          sub="Brother · turns 29"
          count="Today"
        />
        <MockPersonCard
          day={15}
          month="Jun"
          name="Mochi"
          pet
          sub="Pet"
          count="in 3 days"
        />
        <SectionLabel>This month</SectionLabel>
        <MockPersonCard
          day={28}
          month="Jun"
          name="Aunt Mae"
          sub="Family · turns 61"
          count="in 16 days"
        />
      </div>
    </div>
  );
}

/** A reminder with the day-of "Send greeting" quick action (§8.3, FR-28). */
export function ReminderPreview({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-2xl border border-border-subtle bg-surface p-5 shadow-[0_1px_2px_rgba(35,32,32,0.05),0_18px_48px_-12px_rgba(35,32,32,0.18)]",
        className,
      )}
      role="img"
      aria-label="A reminder in the app with a Send greeting action"
    >
      <div className="flex items-start gap-3.5">
        <Ring day={12} month="Jun" size="md" state="today" />
        <div className="flex-1">
          <p className="font-display text-[15px] font-semibold leading-snug text-ink">
            It&apos;s Michael&apos;s birthday today, he turns 29.
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">Brother</p>
        </div>
      </div>
      <div className="mt-4 flex items-center gap-2">
        <span className="inline-flex h-9 items-center gap-1.5 rounded-md bg-biro px-3.5 text-sm font-medium text-paper">
          <MessageCircle size={16} aria-hidden="true" />
          Send greeting
        </span>
        <span className="inline-flex h-9 items-center rounded-md border border-border-strong px-3.5 text-sm font-medium text-ink">
          Mark as done
        </span>
      </div>
    </div>
  );
}

/** The mobile home-screen widget - next 3, ring + name + "in Nd" (§8.13). */
export function WidgetPreview({ className }: { className?: string }) {
  const rows = [
    { day: 12, month: "Jun", name: "Michael Brooks", count: "Today", today: true },
    { day: 15, month: "Jun", name: "Mochi", count: "in 3 days", today: false, pet: true },
    { day: 28, month: "Jun", name: "Aunt Mae", count: "in 16 days", today: false },
  ];
  return (
    <div
      className={cn(
        "w-full max-w-xs rounded-2xl border border-border-subtle bg-surface p-4 shadow-[0_1px_2px_rgba(35,32,32,0.05),0_18px_48px_-12px_rgba(35,32,32,0.18)]",
        className,
      )}
      role="img"
      aria-label="The home-screen widget showing the next 3 events"
    >
      <span className="text-xs font-medium uppercase tracking-wide text-ink-muted">
        Upcoming
      </span>
      <div className="mt-2 flex flex-col">
        {rows.map((row) => (
          <div key={row.name} className="flex items-center gap-3 py-2">
            <Ring
              day={row.day}
              month={row.month}
              size="sm"
              state={row.today ? "today" : "upcoming"}
            />
            <div className="flex min-w-0 flex-1 items-center gap-1.5">
              {row.pet ? (
                <PawPrint size={13} className="shrink-0 text-ink-muted" aria-hidden="true" />
              ) : null}
              <span className="truncate text-sm font-medium text-ink">{row.name}</span>
            </div>
            <span className="shrink-0 text-xs font-medium tabular-nums text-biro">
              {row.count}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
