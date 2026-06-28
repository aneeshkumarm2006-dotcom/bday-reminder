import { useFocusEffect, useRouter } from 'expo-router';
import { Bell, Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, Pressable, ScrollView, View } from 'react-native';

import { PersonCard } from '@/components/person-card';
import { ReminderCard } from '@/components/reminder-card';
import { Button, Chip, EmptyState, Icon, Screen, Sheet, Text, useToast } from '@/components/ui';
import {
  ApiError,
  peopleApi,
  remindersApi,
  type ReminderItem,
  type SnoozePreset,
  type UpcomingGroup,
  type UpcomingResponse,
} from '@/lib/api';
import { cn, focusRing } from '@/lib/cn';
import { syncWidget } from '@/lib/widget';
import { useTokens } from '@/theme/theme-provider';

/**
 * Reminders - the home tab and now the single "what's happening" surface
 * (DESIGN.md §8.3). Two sections: "Needs your attention" (the persistent in-app
 * reminders from `GET /reminders`, with the day-of greeting + done + snooze
 * actions), then "Upcoming" (the computed feed from `GET /upcoming`, grouped This
 * week / This month / Later). An occurrence already shown as an active reminder
 * is dropped from Upcoming so it never appears twice. A relationship-tag chip row
 * filters both sections.
 */

const GROUP_ORDER: UpcomingGroup[] = ['This week', 'This month', 'Later'];

const SNOOZE_TOAST: Record<SnoozePreset, string> = {
  in1h: 'Snoozed for 1 hour.',
  in4h: 'Snoozed for 4 hours.',
  tomorrow: 'Snoozed until tomorrow.',
};

/** Dedup key shared by reminders + upcoming: event + the calendar date (UTC). */
function occKey(eventId: string, occurrenceDate: string): string {
  return `${eventId}|${occurrenceDate.slice(0, 10)}`;
}

export default function RemindersScreen() {
  const router = useRouter();
  const t = useTokens();
  const toast = useToast();

  const [items, setItems] = useState<ReminderItem[] | null>(null);
  const [upcoming, setUpcoming] = useState<UpcomingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [snoozeTarget, setSnoozeTarget] = useState<ReminderItem | null>(null);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const [rem, up] = await Promise.all([remindersApi.list(), peopleApi.upcoming()]);
      setItems(rem.items);
      setUpcoming(up);
      // Keep the home-screen widget cache fed (Stage 10; FR-48) - this is now the
      // screen that loads the Upcoming feed. Native-only + best-effort.
      void syncWidget(up.items);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Couldn't load your reminders. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch on focus so newly-due reminders (and edits elsewhere) show up.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  // Replace one occurrence's reminder row in place after an action (matched by
  // event + occurrence, since a collapsed row's representative id can change).
  const replaceItem = useCallback((previous: ReminderItem, updated: ReminderItem) => {
    setItems((prev) =>
      (prev ?? []).map((it) =>
        it.event.id === previous.event.id && it.occurrenceDate === previous.occurrenceDate
          ? updated
          : it,
      ),
    );
  }, []);

  const onGreet = useCallback(
    async (item: ReminderItem) => {
      const firstName = item.person.fullName.trim().split(/\s+/)[0] ?? item.person.fullName;
      const greeting = `Happy birthday, ${firstName}! 🎉`;
      const phone = item.person.phone ?? '';
      // iOS uses `&` before the body param; Android uses `?`.
      const separator = Platform.OS === 'ios' ? '&' : '?';
      const url = `sms:${phone}${separator}body=${encodeURIComponent(greeting)}`;
      try {
        await Linking.openURL(url);
      } catch {
        toast.show("Couldn't open your messages app.");
      }
    },
    [toast],
  );

  const onDone = useCallback(
    async (item: ReminderItem) => {
      setBusyId(item.id);
      try {
        const { reminder } = await remindersApi.markDone(item.id);
        replaceItem(item, reminder);
        toast.show('Marked as done.');
      } catch (e) {
        toast.show(e instanceof ApiError ? e.message : "Couldn't update. Try again.");
      } finally {
        setBusyId(null);
      }
    },
    [replaceItem, toast],
  );

  const onSnoozePick = useCallback(
    async (preset: SnoozePreset) => {
      const item = snoozeTarget;
      if (!item) return;
      setSnoozeTarget(null);
      setBusyId(item.id);
      try {
        const { reminder } = await remindersApi.snooze(item.id, preset);
        replaceItem(item, reminder);
        toast.show(SNOOZE_TOAST[preset]);
      } catch (e) {
        toast.show(e instanceof ApiError ? e.message : "Couldn't snooze. Try again.");
      } finally {
        setBusyId(null);
      }
    },
    [snoozeTarget, replaceItem, toast],
  );

  if (loading && !items && !upcoming) {
    return (
      <Screen>
        <RemindersHeader onAdd={() => router.push('/add-person')} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={t.biro} />
        </View>
      </Screen>
    );
  }

  if (error && !items && !upcoming) {
    return (
      <Screen>
        <RemindersHeader onAdd={() => router.push('/add-person')} />
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="body" className="text-center text-ink-secondary">
            {error}
          </Text>
          <Button variant="secondary" onPress={() => void load()}>
            Try again
          </Button>
        </View>
      </Screen>
    );
  }

  const reminders = items ?? [];
  // An occurrence with an active reminder shows only in the attention section.
  const activeKeys = new Set(reminders.map((r) => occKey(r.event.id, r.occurrenceDate)));
  const upcomingItems = (upcoming?.items ?? []).filter(
    (i) => !activeKeys.has(occKey(i.eventId, i.occurrenceDate)),
  );

  if (reminders.length === 0 && upcomingItems.length === 0) {
    return (
      <Screen>
        <RemindersHeader onAdd={() => router.push('/add-person')} />
        <EmptyState
          icon={Bell}
          title="You're all caught up."
          body="Add the people you don't want to forget - their birthdays and reminders show up here.">
          <Button leftIcon={Plus} fullWidth onPress={() => router.push('/add-person')}>
            Add person
          </Button>
        </EmptyState>
      </Screen>
    );
  }

  // Tag chips: the union of the Upcoming feed's tags and any tags on reminder
  // people, so filtering applies across both sections.
  const tags = [
    ...new Set(
      [
        ...(upcoming?.tags ?? []),
        ...reminders.map((r) => r.person.relationshipTag).filter((x): x is string => !!x),
      ].filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b));
  const effectiveTag = activeTag && tags.includes(activeTag) ? activeTag : null;

  const visibleReminders = effectiveTag
    ? reminders.filter((r) => r.person.relationshipTag === effectiveTag)
    : reminders;
  const visibleUpcoming = effectiveTag
    ? upcomingItems.filter((i) => i.relationshipTag === effectiveTag)
    : upcomingItems;

  const nothingForTag = visibleReminders.length === 0 && visibleUpcoming.length === 0;

  return (
    <Screen>
      <RemindersHeader onAdd={() => router.push('/add-person')} />

      {tags.length > 0 ? (
        <View className="pb-1">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            <Chip label="All" selected={effectiveTag === null} onPress={() => setActiveTag(null)} />
            {tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                selected={effectiveTag === tag}
                onPress={() => setActiveTag(tag)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {nothingForTag ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text variant="body" className="text-center text-ink-secondary">
            Nothing tagged “{effectiveTag}” right now.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24 }}>
          {visibleReminders.length > 0 ? (
            <>
              <SectionHeader label="Needs your attention" />
              <View className="gap-2">
                {visibleReminders.map((item) => (
                  <ReminderCard
                    key={`${item.event.id}|${item.occurrenceDate}`}
                    item={item}
                    busy={busyId === item.id}
                    onGreet={() => void onGreet(item)}
                    onDone={() => void onDone(item)}
                    onSnooze={() => setSnoozeTarget(item)}
                  />
                ))}
              </View>
            </>
          ) : null}

          {GROUP_ORDER.map((group) => {
            const groupItems = visibleUpcoming.filter((i) => i.group === group);
            if (groupItems.length === 0) return null;
            return (
              <View key={group}>
                <SectionHeader label={group} />
                <View className="gap-2">
                  {groupItems.map((item) => (
                    <PersonCard
                      key={item.eventId}
                      item={item}
                      onPress={() => router.push(`/person/${item.personId}`)}
                    />
                  ))}
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      <Sheet
        visible={snoozeTarget !== null}
        onClose={() => setSnoozeTarget(null)}
        title="Snooze reminder">
        <View className="gap-2">
          <Button variant="secondary" fullWidth onPress={() => void onSnoozePick('in1h')}>
            In 1 hour
          </Button>
          <Button variant="secondary" fullWidth onPress={() => void onSnoozePick('in4h')}>
            In 4 hours
          </Button>
          <Button variant="secondary" fullWidth onPress={() => void onSnoozePick('tomorrow')}>
            Tomorrow
          </Button>
        </View>
      </Sheet>
    </Screen>
  );
}

function RemindersHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <View className="flex-row items-center justify-between pb-2 pt-3">
      <Text variant="title">Reminders</Text>
      <Pressable
        onPress={onAdd}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Add person"
        className={cn('h-9 w-9 items-center justify-center rounded-full active:scale-95', focusRing)}>
        <Icon icon={Plus} size={24} />
      </Pressable>
    </View>
  );
}

/** Section heading on a sunken band (DESIGN.md §8.2, §4.1: Hanken 600 18px). */
function SectionHeader({ label }: { label: string }) {
  return (
    <View className="mb-2 mt-3 rounded-sm bg-surface-sunken px-3 py-2">
      <Text variant="heading">{label}</Text>
    </View>
  );
}
