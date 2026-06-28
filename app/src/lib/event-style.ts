import { Cake, Heart, Star, type LucideIcon } from 'lucide-react-native';

import type { CalendarEvent, EventType } from '@/lib/api';
import type { Tokens } from '@/theme/tokens';

/**
 * One source of truth for how each event type reads on the calendar: its label,
 * its icon, the dot color (a Tailwind `bg-cal-*` class for markers), and the
 * matching token key for places that need a hex (lucide `color` props can't take
 * a className). Birthdays/anniversaries/custom each get their own accent so the
 * grid, the legend and the agenda all stay consistent.
 */

export type EventTypeMeta = {
  label: string;
  Icon: LucideIcon;
  /** Tailwind class for the colored dot marker. */
  dotClass: string;
  /** Key into the theme tokens for a hex color (lucide icon `color`). */
  tokenKey: keyof Pick<Tokens, 'calBirthday' | 'calAnniversary' | 'calCustom'>;
};

const BIRTHDAY: Omit<EventTypeMeta, 'label'> = {
  Icon: Cake,
  dotClass: 'bg-cal-birthday',
  tokenKey: 'calBirthday',
};
const ANNIVERSARY: Omit<EventTypeMeta, 'label'> = {
  Icon: Heart,
  dotClass: 'bg-cal-anniversary',
  tokenKey: 'calAnniversary',
};
const CUSTOM: Omit<EventTypeMeta, 'label'> = {
  Icon: Star,
  dotClass: 'bg-cal-custom',
  tokenKey: 'calCustom',
};

/** Display label + visual treatment for an event. */
export function eventTypeMeta(ev: Pick<CalendarEvent, 'eventType' | 'customName'>): EventTypeMeta {
  if (ev.eventType === 'birthday') return { label: 'Birthday', ...BIRTHDAY };
  if (ev.eventType === 'anniversary') return { label: 'Anniversary', ...ANNIVERSARY };
  return { label: ev.customName ?? 'Event', ...CUSTOM };
}

/** The three event types in legend order, with a fixed label (no custom name). */
export const EVENT_TYPE_LEGEND: { type: EventType; label: string; dotClass: string }[] = [
  { type: 'birthday', label: 'Birthday', dotClass: BIRTHDAY.dotClass },
  { type: 'anniversary', label: 'Anniversary', dotClass: ANNIVERSARY.dotClass },
  { type: 'custom', label: 'Event', dotClass: CUSTOM.dotClass },
];
