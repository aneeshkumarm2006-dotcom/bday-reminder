import { View } from 'react-native';
import { Pressable } from 'react-native';

import { Text } from '@/components/ui';
import type { CalendarEvent } from '@/lib/api';
import { cn, focusRing } from '@/lib/cn';
import { isLeapYear, monthAbbr } from '@/lib/dates';
import { eventTypeMeta, EVENT_TYPE_LEGEND } from '@/lib/event-style';

/**
 * The month-grid calendar (the "Calendar" tab). A plain `Date`-math grid - no
 * date library - that marks the days carrying an event and lets the user pick a
 * day. Each day shows up to three dots colored by event type (birthday /
 * anniversary / custom), so the month is scannable at a glance; the month
 * navigation lives in the shared <CalendarNav> above the grid.
 */

const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

const COL = `${100 / 7}%`;

/** How many colored dots a day cell shows before collapsing into a "+N". */
const MAX_DOTS = 3;

/**
 * The day-of-month an event lands on for a displayed (year, month), or null when
 * it doesn't appear. Only Feb-29 is special: in a non-leap year it's observed by
 * the person's rule - `feb28` → Feb 28, `mar1` → Mar 1 (so it shows in March, not
 * February), `feb29only` → hidden. Every other date is valid in its own month by
 * construction, so it simply lands on its day.
 */
export function eventDayInMonth(ev: CalendarEvent, year: number, month: number): number | null {
  if (ev.month === month) {
    if (month === 2 && ev.day === 29 && !isLeapYear(year)) {
      if (ev.feb29Rule === 'feb28') return 28;
      return null; // feb29only: hidden · mar1: handled in March below
    }
    return ev.day;
  }
  if (month === 3 && ev.month === 2 && ev.day === 29 && !isLeapYear(year) && ev.feb29Rule === 'mar1') {
    return 1;
  }
  return null;
}

export function CalendarGrid({
  year,
  month,
  events,
  today,
  selectedDay,
  onSelectDay,
}: {
  /** Displayed year + 1-based month. */
  year: number;
  month: number;
  events: CalendarEvent[];
  /** "Today" in the user's timezone (from the server), for the highlight. */
  today: { year: number; month: number; day: number };
  selectedDay: number | null;
  onSelectDay: (day: number) => void;
}) {
  // Events per day for the displayed month, in order, for the colored dots.
  const byDay = new Map<number, CalendarEvent[]>();
  for (const ev of events) {
    const d = eventDayInMonth(ev, year, month);
    if (d == null) continue;
    const list = byDay.get(d);
    if (list) list.push(ev);
    else byDay.set(d, [ev]);
  }

  const daysInMonth = new Date(year, month, 0).getDate();
  const startWeekday = new Date(year, month - 1, 1).getDay();
  const isCurrentMonth = today.year === year && today.month === month;

  // Leading blanks (to the first weekday) then the days, padded to full weeks.
  const cells: (number | null)[] = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <View>
      {/* Weekday header */}
      <View className="flex-row">
        {WEEKDAYS.map((w, i) => (
          <View key={i} style={{ width: COL }} className="items-center py-1">
            <Text variant="caption" className="text-ink-muted">
              {w}
            </Text>
          </View>
        ))}
      </View>

      {/* Day cells */}
      <View className="flex-row flex-wrap">
        {cells.map((day, i) => {
          if (day == null) return <View key={`b-${i}`} style={{ width: COL }} className="h-12" />;
          const dayEvents = byDay.get(day) ?? [];
          const count = dayEvents.length;
          const isToday = isCurrentMonth && today.day === day;
          const isSelected = selectedDay === day;
          const overflow = count - MAX_DOTS;
          return (
            <View key={day} style={{ width: COL }} className="p-0.5">
              <Pressable
                onPress={() => onSelectDay(day)}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${monthAbbr(month)} ${day}${
                  count ? `, ${count} event${count > 1 ? 's' : ''}` : ''
                }`}
                className={cn(
                  'h-11 items-center justify-center rounded-md',
                  isSelected ? 'bg-biro' : isToday ? 'bg-biro-tint' : undefined,
                  focusRing,
                )}>
                <Text
                  variant="body"
                  tabularNums
                  className={cn(
                    isSelected ? 'text-paper' : isToday ? 'font-body-medium text-biro' : 'text-ink',
                  )}>
                  {day}
                </Text>
                {/* Reserve the marker row on every cell so numbers stay aligned. */}
                <View className="mt-0.5 h-1.5 flex-row items-center justify-center gap-0.5">
                  {dayEvents.slice(0, MAX_DOTS).map((ev, j) => (
                    <View
                      key={ev.eventId ?? j}
                      className={cn(
                        'h-1.5 w-1.5 rounded-full',
                        isSelected ? 'bg-paper' : eventTypeMeta(ev).dotClass,
                      )}
                    />
                  ))}
                  {overflow > 0 ? (
                    <Text
                      variant="caption"
                      className={cn('text-[9px] leading-none', isSelected ? 'text-paper' : 'text-ink-muted')}>
                      {`+${overflow}`}
                    </Text>
                  ) : null}
                </View>
              </Pressable>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Key explaining the colored dots - shown under the grid in month view. */
export function CalendarLegend() {
  return (
    <View className="mt-1 flex-row flex-wrap items-center justify-center gap-x-4 gap-y-1">
      {EVENT_TYPE_LEGEND.map((item) => (
        <View key={item.type} className="flex-row items-center gap-1.5">
          <View className={cn('h-1.5 w-1.5 rounded-full', item.dotClass)} />
          <Text variant="caption" className="text-ink-muted">
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
