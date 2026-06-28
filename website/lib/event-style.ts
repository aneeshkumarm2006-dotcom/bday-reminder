import { Cake, Heart, Star, type LucideIcon } from "lucide-react";

import type { CalendarEvent, EventType } from "@/lib/api";

/**
 * One source of truth for how each event type reads on the calendar: its label,
 * its icon, and the dot color (a Tailwind `bg-cal-*` class). Birthdays /
 * anniversaries / custom each get their own accent so the grid, the legend and
 * the agenda all stay consistent. Web port of app/src/lib/event-style.ts.
 */

export type EventTypeMeta = {
  label: string;
  Icon: LucideIcon;
  /** Tailwind class for the colored dot marker. */
  dotClass: string;
  /** Tailwind text-color class for the icon. */
  textClass: string;
};

const BIRTHDAY = { Icon: Cake, dotClass: "bg-cal-birthday", textClass: "text-cal-birthday" } as const;
const ANNIVERSARY = {
  Icon: Heart,
  dotClass: "bg-cal-anniversary",
  textClass: "text-cal-anniversary",
} as const;
const CUSTOM = { Icon: Star, dotClass: "bg-cal-custom", textClass: "text-cal-custom" } as const;

/** Display label + visual treatment for an event. */
export function eventTypeMeta(
  ev: Pick<CalendarEvent, "eventType" | "customName">,
): EventTypeMeta {
  if (ev.eventType === "birthday") return { label: "Birthday", ...BIRTHDAY };
  if (ev.eventType === "anniversary") return { label: "Anniversary", ...ANNIVERSARY };
  return { label: ev.customName ?? "Event", ...CUSTOM };
}

/** The three event types in legend order, with a fixed label (no custom name). */
export const EVENT_TYPE_LEGEND: { type: EventType; label: string; dotClass: string }[] = [
  { type: "birthday", label: "Birthday", dotClass: BIRTHDAY.dotClass },
  { type: "anniversary", label: "Anniversary", dotClass: ANNIVERSARY.dotClass },
  { type: "custom", label: "Event", dotClass: CUSTOM.dotClass },
];
