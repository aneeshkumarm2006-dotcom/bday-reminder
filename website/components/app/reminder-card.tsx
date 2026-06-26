"use client";

import { Check, Clock, Copy, MessageCircle } from "lucide-react";
import { useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Ring, type RingState } from "@/components/ring";
import type { ReminderItem, SnoozePreset } from "@/lib/api";
import { occurrenceParts } from "@/lib/occurrence";
import { cn } from "@/lib/utils";

/**
 * Reminder / in-app feed item (DESIGN.md §8.3), web port. Left ring + the
 * server-rendered reminder copy + a status pill; an actions row underneath.
 * "Send greeting" shows only day-of when a phone exists (FR-28/30) — on web it
 * opens WhatsApp/SMS instead of the native Messages app, with a Copy fallback.
 * Done items stay in the feed, de-emphasized with the ring in its done state.
 */

const SNOOZE_PRESETS: { preset: SnoozePreset; label: string }[] = [
  { preset: "in1h", label: "In 1 hour" },
  { preset: "in4h", label: "In 4 hours" },
  { preset: "tomorrow", label: "Tomorrow" },
];

function ringStateFor(item: ReminderItem): RingState {
  if (item.status === "done") return "done";
  if (item.daysRemaining === 0) return "today";
  if (item.daysRemaining < 0) return "past";
  return "upcoming";
}

export function ReminderCard({
  item,
  busy = false,
  onGreet,
  onCopy,
  onDone,
  onSnooze,
}: {
  item: ReminderItem;
  busy?: boolean;
  onGreet: () => void;
  onCopy: () => void;
  onDone: () => void;
  onSnooze: (preset: SnoozePreset) => void;
}) {
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const { day, month } = occurrenceParts(item.occurrenceDate);
  const done = item.status === "done";
  const snoozed = item.status === "snoozed";

  return (
    <div
      className={cn(
        "rounded-lg border border-border-subtle bg-surface p-4",
        done && "opacity-60",
      )}
    >
      <div className="flex items-center gap-3">
        <Ring day={day} month={month} size="md" state={ringStateFor(item)} />
        <div className="min-w-0 flex-1">
          <p className={cn("text-[15px]", done ? "text-ink-muted" : "font-medium text-ink")}>
            {item.message}
          </p>
          {item.person.relationshipTag && (
            <p className="mt-0.5 truncate text-sm text-ink-muted">{item.person.relationshipTag}</p>
          )}
        </div>
        {done ? (
          <Badge tone="ok">Done</Badge>
        ) : snoozed ? (
          <Badge tone="snooze">Snoozed</Badge>
        ) : null}
      </div>

      {!done && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {item.canGreet && (
            <Button size="sm" onClick={onGreet} disabled={busy}>
              <MessageCircle aria-hidden="true" />
              Send greeting
            </Button>
          )}
          {item.canGreet && (
            <Button size="sm" variant="ghost" onClick={onCopy} disabled={busy}>
              <Copy aria-hidden="true" />
              Copy message
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={onDone} disabled={busy}>
            <Check aria-hidden="true" />
            Mark as done
          </Button>
          <div className="relative">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setSnoozeOpen((v) => !v)}
              disabled={busy}
              aria-haspopup="menu"
              aria-expanded={snoozeOpen}
            >
              <Clock aria-hidden="true" />
              Snooze
            </Button>
            {snoozeOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setSnoozeOpen(false)} aria-hidden="true" />
                <div
                  role="menu"
                  className="absolute left-0 top-full z-20 mt-1 w-40 overflow-hidden rounded-md border border-border-subtle bg-surface py-1 shadow-lg"
                >
                  {SNOOZE_PRESETS.map((p) => (
                    <button
                      key={p.preset}
                      role="menuitem"
                      className="block w-full px-3.5 py-2 text-left text-sm text-ink hover:bg-surface-sunken"
                      onClick={() => {
                        setSnoozeOpen(false);
                        onSnooze(p.preset);
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
