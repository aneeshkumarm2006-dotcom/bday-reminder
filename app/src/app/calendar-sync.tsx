import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft, Copy, Link2, RefreshCw } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import {
  Button,
  Card,
  Icon,
  Screen,
  Text,
  ToggleRow,
  useConfirm,
  useToast,
} from '@/components/ui';
import { cn, focusRing } from '@/lib/cn';
import { ApiError, calendarApi, type CalendarSyncSettings } from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import { useTokens } from '@/theme/theme-provider';

/**
 * Calendar sync settings (DESIGN.md §8.10; FR-38/39/40). Opt in, choose what to
 * include (your own birthdays + each shared list you belong to), copy the
 * subscribe link, and reset it to revoke. The feed itself updates automatically
 * as people change (FR-39) — there's nothing to "re-export".
 */
export default function CalendarSyncScreen() {
  const router = useRouter();
  const t = useTokens();
  const toast = useToast();
  const confirm = useConfirm();

  const [settings, setSettings] = useState<CalendarSyncSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSettings(await calendarApi.get());
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load calendar sync. Try again.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  /** Optimistically apply a change, persist it, and reconcile with the server. */
  const save = useCallback(
    async (patch: Parameters<typeof calendarApi.update>[0], optimistic?: Partial<CalendarSyncSettings>) => {
      const previous = settings;
      if (previous && optimistic) setSettings({ ...previous, ...optimistic });
      try {
        setSettings(await calendarApi.update(patch));
      } catch (e) {
        setSettings(previous);
        toast.show(e instanceof ApiError ? e.message : "Couldn't save that. Try again.");
      }
    },
    [settings, toast],
  );

  const onToggleList = (id: string, on: boolean) => {
    if (!settings) return;
    const next = on ? [...settings.lists, id] : settings.lists.filter((l) => l !== id);
    void save({ lists: next }, { lists: next });
  };

  const onCopy = async (url: string, label: string) => {
    const ok = await copyText(url);
    toast.show(ok ? `${label} copied.` : 'Long-press the link to copy it.');
  };

  const onReset = async () => {
    const ok = await confirm({
      title: 'Reset calendar link?',
      message:
        'A new link is created and the old one stops working. Anyone subscribed to the old link will stop getting updates.',
      confirmLabel: 'Reset link',
      destructive: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      setSettings(await calendarApi.rotate());
      toast.show('Calendar link reset.');
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : "Couldn't reset the link. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center gap-2 pb-2 pt-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className={cn('rounded-full', focusRing)}>
          <Icon icon={ChevronLeft} size={24} />
        </Pressable>
        <Text variant="title" className="flex-1" numberOfLines={1}>
          Calendar sync
        </Text>
      </View>

      {settings === null && !error ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={t.biro} />
        </View>
      ) : error && !settings ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="body" className="text-center text-ink-secondary">
            {error}
          </Text>
          <Button variant="secondary" onPress={() => void load()}>
            Try again
          </Button>
        </View>
      ) : settings ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <Text variant="body" className="pb-2 text-ink-secondary">
            Subscribe to your birthdays and events in Apple Calendar, Google Calendar, or Outlook. The
            calendar stays in sync automatically as you add or change people.
          </Text>

          <Card className="mt-2">
            <ToggleRow
              title="Sync to my calendar"
              helper="Turn on a subscribable calendar feed"
              icon={Link2}
              value={settings.enabled}
              onValueChange={(on) => void save({ enabled: on }, { enabled: on })}
            />
          </Card>

          {settings.enabled ? (
            <>
              <Text variant="label" className="mb-2 mt-6 text-ink-muted">
                What to include
              </Text>
              <Card>
                <ToggleRow
                  title="My birthdays"
                  helper="Everyone you've added yourself"
                  value={settings.includePersonal}
                  onValueChange={(on) => void save({ includePersonal: on }, { includePersonal: on })}
                />
                {settings.availableLists.map((list) => (
                  <View key={list.id} className="border-t border-border-subtle">
                    <ToggleRow
                      title={list.name}
                      helper="Shared list"
                      value={settings.lists.includes(list.id)}
                      onValueChange={(on) => onToggleList(list.id, on)}
                    />
                  </View>
                ))}
              </Card>
              {settings.availableLists.length === 0 ? (
                <Text variant="caption" className="mt-2 text-ink-muted">
                  Shared lists you join will appear here so you can sync them too.
                </Text>
              ) : null}

              <Text variant="label" className="mb-2 mt-6 text-ink-muted">
                Your calendar link
              </Text>
              {settings.webcalUrl ? (
                <>
                  <View className="rounded-md border border-border-subtle bg-surface-sunken p-3">
                    <Text variant="caption" selectable className="text-ink">
                      {settings.webcalUrl}
                    </Text>
                  </View>
                  <View className="mt-3 gap-2">
                    <Button leftIcon={Copy} fullWidth onPress={() => void onCopy(settings.webcalUrl!, 'Subscribe link')}>
                      Copy subscribe link
                    </Button>
                    {settings.feedUrl ? (
                      <Button
                        variant="ghost"
                        fullWidth
                        onPress={() => void onCopy(settings.feedUrl!, 'Web address')}>
                        Copy web address (for Google Calendar)
                      </Button>
                    ) : null}
                  </View>

                  <View className="mt-4 rounded-md bg-surface-sunken p-3">
                    <Text variant="caption" className="text-ink-secondary">
                      Apple Calendar / Outlook: copy the subscribe link, then add a calendar
                      subscription and paste it.{'\n'}
                      Google Calendar: use “From URL” and paste the web address.
                    </Text>
                  </View>

                  <View className="mt-6">
                    <Button variant="secondary" leftIcon={RefreshCw} fullWidth loading={busy} onPress={onReset}>
                      Reset link
                    </Button>
                    <Text variant="caption" className="mt-2 text-ink-muted">
                      Resetting creates a new link and stops the old one from working.
                    </Text>
                  </View>
                </>
              ) : null}
            </>
          ) : null}
        </ScrollView>
      ) : null}
    </Screen>
  );
}
