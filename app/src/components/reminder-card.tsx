import { Check, Clock, Copy, MessageCircle } from 'lucide-react-native';
import { View } from 'react-native';

import { DateRing, type RingState } from '@/components/date-ring';
import { Button, Card, Pill, Text } from '@/components/ui';
import type { ReminderItem } from '@/lib/api';
import { monthAbbr } from '@/lib/dates';

/**
 * Reminder / in-app feed item (DESIGN.md §8.3). Left ring + the reminder copy as
 * the primary line + a status pill; an actions row underneath. "Send greeting"
 * and "Copy message" show only day-of when a phone exists (FR-28/30); Done
 * items stay in the feed,
 * de-emphasized with the ring in its done state (§8.3). Microcopy variants
 * (with year / day-of / no year) are authored server-side in `item.message`.
 *
 * The occurrence is a UTC-midnight instant from the server, read in UTC so a
 * timezone can't shift the printed calendar date by a day (matches PersonCard).
 */

function ringStateFor(item: ReminderItem): RingState {
  if (item.status === 'done') return 'done';
  if (item.daysRemaining === 0) return 'today';
  if (item.daysRemaining < 0) return 'past';
  return 'upcoming';
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
  onSnooze: () => void;
}) {
  const occ = new Date(item.occurrenceDate);
  const day = occ.getUTCDate();
  const month = monthAbbr(occ.getUTCMonth() + 1);
  const done = item.status === 'done';
  const snoozed = item.status === 'snoozed';

  return (
    <Card className={done ? 'opacity-60' : undefined}>
      <View className="flex-row items-center gap-3">
        <DateRing
          day={day}
          month={month}
          size="md"
          state={ringStateFor(item)}
          accessibilityLabel={item.message}
        />
        <View className="flex-1">
          <Text variant="body" className={done ? 'text-ink-muted' : 'font-body-medium'}>
            {item.message}
          </Text>
          {item.person.relationshipTag ? (
            <Text variant="caption" numberOfLines={1} className="mt-0.5">
              {item.person.relationshipTag}
            </Text>
          ) : null}
        </View>
        {done ? (
          <Pill label="Done" tone="ok" check />
        ) : snoozed ? (
          <Pill label="Snoozed" tone="snooze" />
        ) : null}
      </View>

      {/* Actions row - hidden once done (§8.3). */}
      {!done ? (
        <View className="mt-3 flex-row flex-wrap items-center gap-2">
          {item.canGreet ? (
            <Button variant="primary" leftIcon={MessageCircle} onPress={onGreet} disabled={busy}>
              Send greeting
            </Button>
          ) : null}
          {item.canGreet ? (
            <Button variant="ghost" leftIcon={Copy} onPress={onCopy} disabled={busy}>
              Copy message
            </Button>
          ) : null}
          <Button variant="secondary" leftIcon={Check} onPress={onDone} loading={busy}>
            Mark as done
          </Button>
          <Button variant="ghost" leftIcon={Clock} onPress={onSnooze} disabled={busy}>
            Snooze
          </Button>
        </View>
      ) : null}
    </Card>
  );
}
