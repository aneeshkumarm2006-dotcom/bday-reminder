/**
 * Home-screen widget data (TODO Stage 10; FR-48/49/50, DESIGN.md §8.13).
 *
 * Pure, platform-agnostic helpers shared by the native bridges (`widget.ios.ts`
 * / `widget.android.ts`), the Android render task handler, and the in-app
 * design preview. No native imports here so it type-checks and bundles
 * everywhere (web included) and can be reasoned about in isolation.
 *
 * The payload caches the next few events on-device as **absolute** occurrence
 * dates. The widget recomputes "days remaining" from those dates on each OS
 * refresh, so the countdown ticks down as days pass without the app being
 * opened (FR-49) - never a stored, going-stale number.
 */

import type { UpcomingItem } from './api';
import { monthAbbr } from './dates';

/** How many events the widget shows (FR-48: "next 3 upcoming"). */
export const WIDGET_EVENT_COUNT = 3;

/** Registered widget name (react-native-android-widget) + iOS kind. */
export const WIDGET_NAME = 'Birthdays';

/** App Group / storage key the iOS WidgetKit extension reads from. */
export const WIDGET_APP_GROUP = 'group.com.circlethedate.app.widget';
export const WIDGET_STORAGE_KEY = 'circle-the-date.widget';

/** The canonical hand-drawn ring path (DESIGN.md §7.4) - shared with the SVG. */
export const RING_PATH =
  'M33 8 C49 7 58 19 57 32 C56 47 41 57 26 55 C12 53 6 39 9 25 C12 13 22 8 36 9';

/** One event as the widget needs it: enough to render a row + deep-link it. */
export type WidgetEvent = {
  /** Deep-link target - tapping opens this person's profile (FR-50). */
  personId: string;
  eventId: string;
  name: string;
  isPet: boolean;
  /** Day-of-month + sentence-case month for the ring (read in UTC). */
  day: number;
  month: string;
  /** Absolute occurrence instant (server UTC midnight) for the live recompute. */
  occurrenceISO: string;
  eventType: 'birthday' | 'anniversary' | 'custom';
  /** Distinguishes non-birthday rows ("Anniversary", a custom name). */
  eventLabel: string | null;
};

export type WidgetPayload = {
  /** When the app last refreshed the cache (for diagnostics / staleness). */
  updatedAtISO: string;
  events: WidgetEvent[];
};

/**
 * Map the computed Upcoming feed into the widget payload, keeping the soonest
 * `WIDGET_EVENT_COUNT`. The feed is already grouped + sorted ascending by the
 * server, so the first N are the next N events.
 */
export function buildWidgetPayload(
  items: UpcomingItem[],
  now: Date = new Date(),
): WidgetPayload {
  const events = items.slice(0, WIDGET_EVENT_COUNT).map((item): WidgetEvent => {
    // The occurrence is a UTC-midnight instant; read the calendar date in UTC
    // so a timezone never shifts the ring's day by one (matches PersonCard).
    const occ = new Date(item.occurrenceDate);
    const eventLabel =
      item.eventType === 'birthday'
        ? null
        : item.eventType === 'anniversary'
          ? 'Anniversary'
          : (item.customName ?? 'Event');
    return {
      personId: item.personId,
      eventId: item.eventId,
      name: item.fullName,
      isPet: item.type === 'pet',
      day: occ.getUTCDate(),
      month: monthAbbr(occ.getUTCMonth() + 1),
      occurrenceISO: item.occurrenceDate,
      eventType: item.eventType,
      eventLabel,
    };
  });
  return { updatedAtISO: now.toISOString(), events };
}

/**
 * Whole days from "today" until an occurrence, recomputed live. "Today" is the
 * device's local calendar day, pinned to UTC midnight to compare against the
 * server's UTC-midnight occurrence - DST-proof day math (mirrors the backend).
 */
export function daysUntilOccurrence(occurrenceISO: string, now: Date = new Date()): number {
  const occ = new Date(occurrenceISO);
  const occUTC = Date.UTC(occ.getUTCFullYear(), occ.getUTCMonth(), occ.getUTCDate());
  const todayUTC = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.round((occUTC - todayUTC) / 86_400_000);
}

/** Compact countdown for the tight widget row (DESIGN.md §8.13: "in Nd"). */
export function widgetCountdown(days: number): string {
  if (days <= 0) return 'Today';
  if (days === 1) return 'in 1 day';
  return `in ${days} days`;
}

/** Deep link into a person's profile - the FR-50 tap target. */
export function deepLinkForPerson(personId: string): string {
  return `circlethedate://person/${personId}`;
}
