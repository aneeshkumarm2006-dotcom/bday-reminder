import { PawPrint } from 'lucide-react-native';
import { View } from 'react-native';

import { eventDayInMonth } from '@/components/calendar-grid';
import { Card, Icon, Text } from '@/components/ui';
import type { CalendarEvent } from '@/lib/api';
import { cn } from '@/lib/cn';
import { monthAbbr } from '@/lib/dates';
import { eventTypeMeta } from '@/lib/event-style';
import { useTokens } from '@/theme/theme-provider';

/**
 * The agenda (list) view of the calendar: the displayed month's events in date
 * order, one row each, easier to skim than tapping day by day. Tapping a row
 * opens that person. Same data and Feb-29 placement as the grid (via
 * eventDayInMonth), just laid out as a list.
 */

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function CalendarAgenda({
  year,
  month,
  events,
  today,
  onSelectPerson,
}: {
  year: number;
  month: number;
  events: CalendarEvent[];
  today: { year: number; month: number; day: number };
  onSelectPerson: (personId: string) => void;
}) {
  const t = useTokens();
  const isCurrentMonth = today.year === year && today.month === month;

  // Resolve each event to its day this month, drop the ones that don't appear,
  // then sort by day and name so the list reads top-to-bottom through the month.
  const rows = events
    .map((ev) => ({ ev, day: eventDayInMonth(ev, year, month) }))
    .filter((r): r is { ev: CalendarEvent; day: number } => r.day != null)
    .sort((a, b) => a.day - b.day || a.ev.fullName.localeCompare(b.ev.fullName));

  if (rows.length === 0) {
    return (
      <Text variant="body" className="mt-6 text-center text-ink-secondary">
        {`No events in ${MONTH_NAMES[month - 1]}.`}
      </Text>
    );
  }

  return (
    <View className="gap-2">
      {rows.map(({ ev, day }) => {
        const meta = eventTypeMeta(ev);
        const isToday = isCurrentMonth && today.day === day;
        const sub = [meta.label, ev.relationshipTag ?? undefined].filter(Boolean).join(' · ');
        return (
          <Card
            key={ev.eventId}
            accessibilityLabel={`${ev.fullName}, ${sub}, ${monthAbbr(month)} ${day}`}
            onPress={() => onSelectPerson(ev.personId)}>
            <View className="flex-row items-center gap-3">
              {/* Date badge */}
              <View
                className={cn(
                  'h-10 w-10 items-center justify-center rounded-md',
                  isToday ? 'bg-biro' : 'bg-surface-sunken',
                )}>
                <Text
                  variant="cardName"
                  tabularNums
                  className={cn('leading-none', isToday ? 'text-paper' : 'text-ink')}>
                  {day}
                </Text>
                <Text
                  variant="caption"
                  className={cn('mt-0.5 leading-none', isToday ? 'text-paper' : 'text-ink-muted')}>
                  {monthAbbr(month)}
                </Text>
              </View>

              <Icon icon={meta.Icon} size={16} color={t[meta.tokenKey]} label={meta.label} />

              <View className="min-w-0 flex-1">
                <View className="flex-row items-center gap-1.5">
                  {ev.type === 'pet' ? (
                    <Icon icon={PawPrint} size={14} color={t.inkMuted} label="Pet" />
                  ) : null}
                  <Text variant="cardName" numberOfLines={1} className="flex-1">
                    {ev.fullName}
                  </Text>
                </View>
                {sub ? (
                  <Text variant="caption" numberOfLines={1} className="mt-0.5">
                    {sub}
                  </Text>
                ) : null}
              </View>
            </View>
          </Card>
        );
      })}
    </View>
  );
}
