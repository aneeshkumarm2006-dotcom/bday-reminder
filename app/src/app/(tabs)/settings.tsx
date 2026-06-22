import { useRouter } from 'expo-router';
import {
  CalendarPlus,
  ChevronRight,
  LayoutGrid,
  Sparkles,
  Upload,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  ChannelToggles,
  DEFAULT_CHANNELS,
  LeadTimeChips,
  ReminderTimePicker,
} from '@/components/reminder-prefs';
import { Button, Card, Chip, Icon, Screen, Text, useConfirm, useToast } from '@/components/ui';
import { configApi, type ChannelPreferences, type UpdateMeInput } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { useThemePreference, type ThemePreference } from '@/theme/theme-provider';

const THEME_OPTIONS: { label: string; value: ThemePreference }[] = [
  { label: 'System', value: 'system' },
  { label: 'Light', value: 'light' },
  { label: 'Dark', value: 'dark' },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <Text variant="label" className="mb-2 mt-6 text-ink-muted">
      {children}
    </Text>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user, signOut, updateProfile } = useAuth();
  const { preference, setPreference } = useThemePreference();
  const confirm = useConfirm();
  const toast = useToast();

  // The user is the single source of truth; updateProfile is optimistic, so the
  // controls read straight from it (and stay correct even when settings mounts
  // before the user has finished hydrating on a fresh load).
  const channels = user?.channelPreferences ?? DEFAULT_CHANNELS;
  const leadDays = user?.defaultLeadDays ?? [0, 7];
  const reminderTime = user?.defaultReminderTime ?? '09:00';
  const [smsCap, setSmsCap] = useState<number | null>(null);

  // The cap is a business-config value, fetched (not hardcoded) for the note.
  useEffect(() => {
    let active = true;
    configApi
      .get()
      .then((c) => active && setSmsCap(c.smsWhatsappMonthlyCap))
      .catch(() => {
        /* note falls back to number-free copy */
      });
    return () => {
      active = false;
    };
  }, []);

  const save = (patch: UpdateMeInput) => {
    updateProfile(patch).catch(() => {
      toast.show("Couldn't save that. Check your connection and try again.");
    });
  };

  const onChannels = (next: ChannelPreferences) => save({ channelPreferences: next });
  const onLeadDays = (next: number[]) => save({ defaultLeadDays: next });
  const onReminderTime = (next: string) => save({ defaultReminderTime: next });

  const onLogout = async () => {
    const ok = await confirm({
      title: 'Log out?',
      message: 'You can log back in any time. Your data stays synced to your account.',
      confirmLabel: 'Log out',
      cancelLabel: 'Stay',
    });
    if (ok) await signOut();
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="pb-2 pt-3">
          <Text variant="title">Settings</Text>
        </View>

        <SectionLabel>Account</SectionLabel>
        <Card>
          <Text variant="cardName">{user?.name ?? 'Your account'}</Text>
          {user?.email ? (
            <Text variant="body" className="mt-0.5 text-ink-secondary">
              {user.email}
            </Text>
          ) : null}
        </Card>

        <SectionLabel>Notify me by</SectionLabel>
        <Card>
          <ChannelToggles
            value={channels}
            onChange={onChannels}
            smsCap={smsCap}
            zeroMessage="You won't be notified anywhere. Reminders still appear in your in-app feed."
          />
        </Card>

        <SectionLabel>Remind me ahead of time</SectionLabel>
        <LeadTimeChips value={leadDays} onChange={onLeadDays} />
        <Text variant="caption" className="mt-2 text-ink-muted">
          Applies to everyone unless you set an override on a person.
        </Text>

        <SectionLabel>Reminder time</SectionLabel>
        <ReminderTimePicker value={reminderTime} onChange={onReminderTime} />
        <Text variant="caption" className="mt-2 text-ink-muted">
          Reminders arrive at this time in your local timezone.
        </Text>

        <SectionLabel>Appearance</SectionLabel>
        <View className="flex-row gap-2">
          {THEME_OPTIONS.map((option) => (
            <View key={option.value} className="flex-1">
              <Chip
                label={option.label}
                selected={preference === option.value}
                onPress={() => setPreference(option.value)}
              />
            </View>
          ))}
        </View>
        <Text variant="caption" className="mt-2 text-ink-muted">
          The warm paper background stays warm in dark mode.
        </Text>

        <SectionLabel>Calendar</SectionLabel>
        <Pressable onPress={() => router.push('/calendar-sync')}>
          <Card className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Icon icon={CalendarPlus} size={20} />
              <Text variant="body">Calendar sync</Text>
            </View>
            <Icon icon={ChevronRight} size={20} />
          </Card>
        </Pressable>
        <Text variant="caption" className="mt-2 text-ink-muted">
          Subscribe to your birthdays in Apple, Google, or Outlook calendars.
        </Text>

        <SectionLabel>People</SectionLabel>
        <Pressable onPress={() => router.push('/import')}>
          <Card className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Icon icon={Upload} size={20} />
              <Text variant="body">Import people</Text>
            </View>
            <Icon icon={ChevronRight} size={20} />
          </Card>
        </Pressable>

        <SectionLabel>Home screen</SectionLabel>
        <Pressable onPress={() => router.push('/widget-preview')}>
          <Card className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Icon icon={LayoutGrid} size={20} />
              <Text variant="body">Home screen widget</Text>
            </View>
            <Icon icon={ChevronRight} size={20} />
          </Card>
        </Pressable>
        <Text variant="caption" className="mt-2 text-ink-muted">
          Your next 3 events on your phone&apos;s home screen. Add it from the home screen on
          iOS or Android.
        </Text>

        <SectionLabel>Design</SectionLabel>
        <Pressable onPress={() => router.push('/ring-preview')}>
          <Card className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3">
              <Icon icon={Sparkles} size={20} />
              <Text variant="body">Ring preview</Text>
            </View>
            <Icon icon={ChevronRight} size={20} />
          </Card>
        </Pressable>

        <View className="mt-8">
          <Button variant="secondary" fullWidth onPress={onLogout}>
            Log out
          </Button>
        </View>
      </ScrollView>
    </Screen>
  );
}
