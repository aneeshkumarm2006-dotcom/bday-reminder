import { useRouter } from 'expo-router';
import { Bell, ChevronLeft, PawPrint } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';

import { DateRing } from '@/components/date-ring';
import { Icon, Screen, Text } from '@/components/ui';
import { cn, focusRing } from '@/lib/cn';
import { ApiError, peopleApi } from '@/lib/api';
import {
  buildWidgetPayload,
  daysUntilOccurrence,
  widgetCountdown,
  type WidgetEvent,
} from '@/lib/widget-data';
import { useTokens } from '@/theme/theme-provider';

/**
 * Home-screen widget preview (TODO Stage 10; DESIGN.md §8.13). The real widget
 * is native (iOS WidgetKit / Android App Widget) and can't render on web, so
 * this surface mirrors its look with RN primitives - driven by the *same* pure
 * `buildWidgetPayload` + countdown logic the native widgets use - to verify the
 * next-3 selection and the layout (`DateRing sm` + name + "in Nd", radius-xl,
 * surface over paper). On a phone the live widget lives on the home screen and
 * deep-links into a profile (FR-50); here, tapping a row does the same.
 */
export default function WidgetPreviewScreen() {
  const router = useRouter();
  const t = useTokens();

  const [events, setEvents] = useState<WidgetEvent[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    peopleApi
      .upcoming()
      .then((res) => {
        if (active) setEvents(buildWidgetPayload(res.items).events);
      })
      .catch((e) => {
        if (active) {
          setError(
            e instanceof ApiError
              ? e.message
              : "Couldn't load your widget preview. Check your connection and try again.",
          );
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-2 pb-2 pt-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className={cn('rounded-full', focusRing)}>
          <Icon icon={ChevronLeft} size={24} />
        </Pressable>
        <Text variant="title">Home screen widget</Text>
      </View>

      <Text variant="body" className="mb-5 text-ink-secondary">
        Your next 3 events, on your phone&apos;s home screen. It updates itself as days pass
        and opens a profile when you tap a name.
      </Text>

      {/* The widget mockup: radius-xl surface over paper (DESIGN.md §8.13). */}
      <View className="rounded-xl border border-border-subtle bg-surface p-4">
        <Text variant="label" className="mb-1 text-ink-muted">
          Upcoming
        </Text>

        {error ? (
          <Text variant="body" className="py-3 text-ink-secondary">
            {error}
          </Text>
        ) : events === null ? (
          <View className="items-center py-6">
            <ActivityIndicator color={t.biro} />
          </View>
        ) : events.length === 0 ? (
          <Text variant="body" className="py-3 text-ink-secondary">
            No birthdays yet.
          </Text>
        ) : (
          <View>
            {events.map((event) => (
              <WidgetRow
                key={event.eventId}
                event={event}
                onPress={() => router.push(`/person/${event.personId}`)}
              />
            ))}
          </View>
        )}
      </View>

      <Text variant="caption" className="mt-4 text-ink-muted">
        Add it from your home screen: long-press an empty spot → Widgets → Circle the date.
      </Text>
    </Screen>
  );
}

function WidgetRow({ event, onPress }: { event: WidgetEvent; onPress: () => void }) {
  const t = useTokens();
  const days = daysUntilOccurrence(event.occurrenceISO);
  const isToday = days <= 0;
  const subtitle = event.eventLabel ?? (event.isPet ? 'Pet' : null);

  return (
    <Pressable
      className={cn('flex-row items-center gap-3 rounded-sm py-2 active:opacity-70', focusRing)}
      accessibilityRole="button"
      accessibilityLabel={event.name}
      onPress={onPress}>
      <DateRing
        day={event.day}
        month={event.month}
        size="sm"
        state={isToday ? 'today' : 'upcoming'}
        accessibilityLabel={`${event.name}, ${event.day} ${event.month}`}
      />
      <View className="flex-1">
        <View className="flex-row items-center gap-1.5">
          {event.isPet ? <Icon icon={PawPrint} size={14} color={t.inkMuted} label="Pet" /> : null}
          <Text variant="cardName" numberOfLines={1} className="flex-shrink">
            {event.name}
          </Text>
        </View>
        {subtitle ? (
          <Text variant="caption" numberOfLines={1} className="mt-0.5">
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View className="flex-row items-center gap-1">
        {!isToday ? <Icon icon={Bell} size={14} color={t.biro} /> : null}
        <Text variant="caption" tabularNums className="font-body-medium text-biro">
          {widgetCountdown(days)}
        </Text>
      </View>
    </Pressable>
  );
}
