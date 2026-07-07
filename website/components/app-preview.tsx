"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Bell, Check, ChevronRight, MessageCircle, PawPrint, Send } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { InteractiveRing } from "@/components/interactive-ring";
import type { RingState } from "@/components/ring";
import { dayCaption, useToday } from "@/lib/use-today";
import { cn } from "@/lib/utils";

/**
 * On-brand "screenshots" of the app, rendered from the same design system
 * (DESIGN.md §8.1/§8.3/§8.13) rather than raster images - so they stay crisp,
 * themeable (light/dark), and always match the real UI.
 *
 * These aren't dead images: they *respond*. Tapping a feed row marks it done
 * (the ring fills and a check pops), the reminder card opens a real send-greeting
 * flow, and the widget rows behave like the phone. It's a hands-on demo of the
 * product on the marketing page. All of it degrades to a calm static state under
 * `prefers-reduced-motion`.
 */

/** A feed row you can actually tap to mark done (and tap again to undo). */
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
  const reduced = useReducedMotion();
  const [done, setDone] = useState(false);
  const ringState: RingState = done ? "done" : state;

  return (
    <motion.button
      type="button"
      onClick={() => setDone((d) => !d)}
      aria-pressed={done}
      aria-label={
        done
          ? `${name} - marked done. Tap to undo.`
          : `${name}, ${sub}, ${count}. Tap to mark done.`
      }
      initial="rest"
      animate="rest"
      whileHover="hover"
      whileTap={reduced ? undefined : { scale: 0.985 }}
      variants={{
        rest: { borderColor: "var(--border-subtle)" },
        hover: { borderColor: "var(--biro)" },
      }}
      className="group/card flex w-full items-center gap-3.5 rounded-lg border bg-surface p-4 text-left transition-shadow hover:shadow-[0_12px_26px_-18px_rgba(44,75,216,0.55)]"
    >
      <InteractiveRing day={day} month={month} size="md" state={ringState} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <div className="flex min-w-0 items-center gap-1.5">
          {pet ? (
            <PawPrint size={15} className="shrink-0 text-ink-secondary" aria-hidden="true" />
          ) : null}
          <span
            className={cn(
              "truncate font-display text-[15px] font-semibold transition-colors duration-200",
              done ? "text-ink-muted" : "text-ink",
            )}
          >
            {name}
          </span>
        </div>
        <span className="text-xs text-ink-muted">{sub}</span>
      </div>
      <div className="flex h-5 shrink-0 items-center justify-end">
        <AnimatePresence mode="wait" initial={false}>
          {done ? (
            <motion.span
              key="done"
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: -6 }}
              transition={{ duration: 0.18 }}
              className="inline-flex items-center gap-1 text-xs font-medium text-ok-fg"
            >
              <Check size={13} strokeWidth={3} aria-hidden="true" />
              Done
            </motion.span>
          ) : (
            <motion.span
              key="count"
              initial={reduced ? { opacity: 0 } : { opacity: 0, x: 6 }}
              animate={{ opacity: 1, x: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, x: -6 }}
              transition={{ duration: 0.18 }}
              className="inline-flex items-center gap-1.5 text-xs font-medium tabular-nums text-biro"
            >
              {!today ? (
                <motion.span
                  variants={{
                    rest: { rotate: 0 },
                    hover: reduced ? { rotate: 0 } : { rotate: [0, -12, 10, -6, 3, 0] },
                  }}
                  transition={{ duration: 0.6, ease: "easeInOut" }}
                  className="inline-flex"
                  style={{ transformOrigin: "50% 20%" }}
                >
                  <Bell size={14} className="text-biro" aria-hidden="true" />
                </motion.span>
              ) : null}
              {count}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </motion.button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-sm bg-surface-sunken px-3 py-1.5">
      <span className="font-display text-sm font-semibold text-ink">{children}</span>
    </div>
  );
}

/** The Upcoming feed - grouped + sorted, each row tappable (§8.2). */
export function AppPreview({ className }: { className?: string }) {
  const today = useToday();
  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-2xl border border-border-subtle bg-paper p-4 shadow-[0_1px_2px_rgba(35,32,32,0.05),0_18px_48px_-12px_rgba(35,32,32,0.18)]",
        className,
      )}
      role="group"
      aria-label="Interactive preview of the Upcoming feed - tap a person to mark them done"
    >
      <div className="mb-3 flex items-center justify-between px-1">
        <span className="font-display text-xl font-semibold tracking-[-0.01em] text-ink">
          Upcoming
        </span>
      </div>
      <div className="flex flex-col gap-2">
        <SectionLabel>This week</SectionLabel>
        <MockPersonCard
          {...dayCaption(today)}
          state="today"
          today
          name="Michael Brooks"
          sub="Brother · turns 29"
          count="Today"
        />
        <MockPersonCard {...dayCaption(today, 3)} name="Mochi" pet sub="Pet" count="in 3 days" />
        <SectionLabel>This month</SectionLabel>
        <MockPersonCard
          {...dayCaption(today, 16)}
          name="Aunt Mae"
          sub="Family · turns 61"
          count="in 16 days"
        />
      </div>
    </div>
  );
}

type ReminderPhase = "idle" | "composing" | "sent";
const GREETING = "Happy birthday, Michael! 🎉";

/**
 * A reminder with a working day-of "Send greeting" flow (§8.3, FR-28). Tapping
 * it opens an inline composer with an editable-feeling message; sending it plays
 * the message into a delivered chat bubble - the same "review, then send" beat
 * as the app. "Mark as done" flips the ring to its done state.
 */
export function ReminderPreview({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const today = useToday();
  const [phase, setPhase] = useState<ReminderPhase>("idle");
  const [done, setDone] = useState(false);

  const fade = {
    initial: reduced ? { opacity: 0 } : { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: reduced ? { opacity: 0 } : { opacity: 0, y: -8 },
    transition: { duration: 0.22, ease: "easeOut" as const },
  };

  return (
    <div
      className={cn(
        "w-full max-w-sm rounded-2xl border border-border-subtle bg-surface p-5 shadow-[0_1px_2px_rgba(35,32,32,0.05),0_18px_48px_-12px_rgba(35,32,32,0.18)]",
        className,
      )}
      role="group"
      aria-label="Interactive reminder - send a greeting or mark it done"
    >
      <div className="flex items-start gap-3.5">
        <InteractiveRing {...dayCaption(today)} size="md" state={done ? "done" : "today"} />
        <div className="flex-1">
          <p
            className={cn(
              "font-display text-[15px] font-semibold leading-snug transition-colors duration-200",
              done ? "text-ink-muted" : "text-ink",
            )}
          >
            It&apos;s Michael&apos;s birthday today, he turns 29.
          </p>
          <p className="mt-0.5 text-xs text-ink-muted">Brother</p>
        </div>
      </div>

      <div className="mt-4">
        <AnimatePresence mode="wait" initial={false}>
          {phase === "idle" ? (
            <motion.div key="idle" {...fade} className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPhase("composing")}
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-biro px-3.5 text-sm font-medium text-paper transition-[background-color,transform] hover:bg-biro-hover active:scale-[0.97]"
              >
                <MessageCircle size={16} aria-hidden="true" />
                Send greeting
              </button>
              <button
                type="button"
                onClick={() => setDone((d) => !d)}
                aria-pressed={done}
                className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-strong px-3.5 text-sm font-medium text-ink transition-[background-color,transform] hover:bg-surface-sunken active:scale-[0.97]"
              >
                {done ? (
                  <>
                    <Check size={15} strokeWidth={3} className="text-ok-fg" aria-hidden="true" />
                    Done · undo
                  </>
                ) : (
                  "Mark as done"
                )}
              </button>
            </motion.div>
          ) : null}

          {phase === "composing" ? (
            <motion.div key="composing" {...fade}>
              <div className="rounded-xl border border-border-subtle bg-surface-sunken p-2.5">
                <div className="flex items-end gap-2">
                  <div className="flex-1 rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-ink">
                    {GREETING}
                    <motion.span
                      aria-hidden="true"
                      className="ml-0.5 inline-block w-px align-middle text-biro"
                      animate={reduced ? undefined : { opacity: [1, 1, 0, 0] }}
                      transition={{ repeat: Infinity, duration: 1, times: [0, 0.5, 0.5, 1] }}
                    >
                      |
                    </motion.span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setPhase("sent")}
                    aria-label="Send greeting"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-biro text-paper transition-[background-color,transform] hover:bg-biro-hover active:scale-90"
                  >
                    <Send size={16} aria-hidden="true" />
                  </button>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPhase("idle")}
                className="mt-2 text-xs font-medium text-ink-muted transition-colors hover:text-ink"
              >
                Cancel
              </button>
            </motion.div>
          ) : null}

          {phase === "sent" ? (
            <motion.div key="sent" {...fade}>
              <div className="flex justify-end">
                <motion.div
                  initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.85, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={reduced ? { duration: 0 } : { type: "spring", stiffness: 460, damping: 26 }}
                  className="max-w-[80%] rounded-2xl rounded-br-sm bg-biro px-3.5 py-2 text-sm text-paper shadow-[0_6px_16px_-8px_rgba(44,75,216,0.6)]"
                >
                  {GREETING}
                </motion.div>
              </div>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduced ? 0 : 0.25 }}
                className="mt-1.5 flex items-center justify-end gap-1 text-[11px] text-ink-muted"
              >
                <Check size={12} strokeWidth={3} className="text-ok-fg" aria-hidden="true" />
                Delivered
              </motion.div>
              <button
                type="button"
                onClick={() => setPhase("idle")}
                className="mt-3 text-xs font-medium text-biro transition-colors hover:text-biro-hover"
              >
                Send another
              </button>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  );
}

/** The mobile home-screen widget - next 3, each row taps through to a profile (§8.13). */
export function WidgetPreview({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const today = useToday();
  const [opening, setOpening] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const openProfile = (name: string) => {
    setOpening(name);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setOpening(null), 1100);
  };

  const rows = [
    { ...dayCaption(today), name: "Michael Brooks", count: "Today", today: true, pet: false },
    { ...dayCaption(today, 3), name: "Mochi", count: "in 3 days", today: false, pet: true },
    { ...dayCaption(today, 16), name: "Aunt Mae", count: "in 16 days", today: false, pet: false },
  ];

  return (
    <div
      className={cn(
        "w-full max-w-xs rounded-2xl border border-border-subtle bg-surface p-4 shadow-[0_1px_2px_rgba(35,32,32,0.05),0_18px_48px_-12px_rgba(35,32,32,0.18)]",
        className,
      )}
      role="group"
      aria-label="Interactive home-screen widget - tap a person to open their profile"
    >
      <span className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
        Upcoming
      </span>
      <div className="mt-2 flex flex-col">
        {rows.map((row) => {
          const isOpening = opening === row.name;
          return (
            <motion.button
              key={row.name}
              type="button"
              onClick={() => openProfile(row.name)}
              aria-label={`${row.name}, ${row.count}. Tap to open profile.`}
              whileTap={reduced ? undefined : { scale: 0.98 }}
              className="group/w flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-surface-sunken"
            >
              <InteractiveRing
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
              <div className="flex shrink-0 items-center gap-1">
                <AnimatePresence mode="wait" initial={false}>
                  {isOpening ? (
                    <motion.span
                      key="opening"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-xs font-medium text-ink-muted"
                    >
                      Opening…
                    </motion.span>
                  ) : (
                    <motion.span
                      key="count"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.15 }}
                      className="text-xs font-medium tabular-nums text-biro"
                    >
                      {row.count}
                    </motion.span>
                  )}
                </AnimatePresence>
                <ChevronRight
                  size={14}
                  aria-hidden="true"
                  className="text-ink-muted opacity-0 transition-[opacity,transform] duration-200 group-hover/w:translate-x-0.5 group-hover/w:opacity-100"
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
