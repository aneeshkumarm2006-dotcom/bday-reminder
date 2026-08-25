import { Bell, PawPrint } from 'lucide-react-native';
import { View } from 'react-native';

import { DateRing } from '@/components/date-ring';
import { Card, Icon, Pill, Text } from '@/components/ui';
import type { UpcomingItem } from '@/lib/api';
import { countdownLabel, monthAbbr, ordinalYear } from '@/lib/dates';
import { useTokens } from '@/theme/theme-provider';

/**
 * Person / event card - the feed hero (DESIGN.md §8.1). Layout:
 * `[ DateRing md ] [ name + relationship · age ] [ countdown ]`. The ring (the
 * date) leads, never a photo. Pets get a `paw-print` before the name; age is
 * omitted entirely when no birth year is known (FR-14). Tapping opens the
 * profile (FR-50 deep-link target).
 *
 * A milestone - a year count landing on a multiple of five - gets a pill beside
 * the name, so a silver wedding doesn't read like every other row in the list.
 * The server owns the rule (`isMilestone`), so the feed, the reminder copy and
 * the push title can't disagree about what counts.
 *
 * The occurrence is a UTC-midnight instant from the server, so the day/month
 * are read in UTC to avoid a timezone shifting the calendar date by a day.
 */
export function PersonCard({ item, onPress }: { item: UpcomingItem; onPress?: () => void }) {
  const t = useTokens();

  const occ = new Date(item.occurrenceDate);
  const day = occ.getUTCDate();
  const month = monthAbbr(occ.getUTCMonth() + 1);
  const isToday = item.daysRemaining === 0;

  // A person can appear once per event (birthday + anniversary + custom). Name
  // the event on non-birthday cards so the rows are distinguishable (FR-16).
  const eventLabel =
    item.eventType === 'birthday'
      ? undefined
      : item.eventType === 'anniversary'
        ? 'Anniversary'
        : (item.customName ?? 'Event');

  const subtitle = [
    eventLabel,
    item.relationshipTag ?? undefined,
    item.ageTurning != null ? `turns ${item.ageTurning}` : undefined,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card onPress={onPress}>
      <View className="flex-row items-center gap-3">
        <DateRing
          day={day}
          month={month}
          size="md"
          state={isToday ? 'today' : 'upcoming'}
          accessibilityLabel={`${item.fullName}, ${day} ${month}`}
        />

        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            {item.type === 'pet' ? (
              <Icon icon={PawPrint} size={16} color={t.inkMuted} label="Pet" />
            ) : null}
            <Text variant="cardName" numberOfLines={1} className="flex-shrink">
              {item.fullName}
            </Text>
            {item.isMilestone && item.yearsMarking != null ? (
              <Pill label={ordinalYear(item.yearsMarking)} tone="info" />
            ) : null}
          </View>
          {subtitle ? (
            <Text variant="caption" tabularNums numberOfLines={1} className="mt-0.5">
              {subtitle}
            </Text>
          ) : null}
        </View>

        <View className="flex-row items-center gap-1 pl-2">
          {!isToday ? <Icon icon={Bell} size={16} color={t.biro} /> : null}
          <Text variant="caption" tabularNums className="font-body-medium text-biro">
            {countdownLabel(item.daysRemaining)}
          </Text>
        </View>
      </View>
    </Card>
  );
}
