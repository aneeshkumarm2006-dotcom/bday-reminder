import { useFocusEffect } from 'expo-router';
import { Bell } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, View } from 'react-native';

import { ReminderCard } from '@/components/reminder-card';
import { Button, EmptyState, Screen, Sheet, Text, useToast } from '@/components/ui';
import { ApiError, remindersApi, type ReminderItem, type SnoozePreset } from '@/lib/api';
import { useTokens } from '@/theme/theme-provider';

/**
 * In-app reminder feed (DESIGN.md §8.3; FR-27/28/31/33). Lists the persistent
 * reminders from `GET /reminders` - they never vanish on view. Each row supports
 * the day-of "Send greeting" quick action (opens the messaging app with an
 * editable template, never auto-sent - FR-29), "Mark as done", and "Snooze".
 * Toasts confirm each action with the spec's verb-consistent copy (§8.11).
 */

const SNOOZE_TOAST: Record<SnoozePreset, string> = {
  in1h: 'Snoozed for 1 hour.',
  in4h: 'Snoozed for 4 hours.',
  tomorrow: 'Snoozed until tomorrow.',
};

export default function RemindersScreen() {
  const t = useTokens();
  const toast = useToast();

  const [items, setItems] = useState<ReminderItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [snoozeTarget, setSnoozeTarget] = useState<ReminderItem | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      setItems((await remindersApi.list()).items);
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

  // Replace one occurrence's row in place after an action (matched by event +
  // occurrence, since a collapsed row's representative id can change).
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

  return (
    <Screen>
      <View className="pb-2 pt-3">
        <Text variant="title">Reminders</Text>
      </View>

      {loading && !items ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={t.biro} />
        </View>
      ) : error && !items ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="body" className="text-center text-ink-secondary">
            {error}
          </Text>
          <Button variant="secondary" onPress={() => void load()}>
            Try again
          </Button>
        </View>
      ) : !items || items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No reminders yet."
          body="When a birthday is coming up, your reminders show up here."
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24, gap: 8 }}>
          {items.map((item) => (
            <ReminderCard
              key={`${item.event.id}|${item.occurrenceDate}`}
              item={item}
              busy={busyId === item.id}
              onGreet={() => void onGreet(item)}
              onDone={() => void onDone(item)}
              onSnooze={() => setSnoozeTarget(item)}
            />
          ))}
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
