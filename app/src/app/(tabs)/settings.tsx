import { useRouter } from 'expo-router';
import {
  CalendarPlus,
  ChevronRight,
  LayoutGrid,
  Mail,
  Sparkles,
  Upload,
} from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';

import {
  ChannelToggles,
  DEFAULT_CHANNELS,
  LeadTimeChips,
  ReminderTimePicker,
} from '@/components/reminder-prefs';
import { Button, Card, Chip, Icon, Screen, Text, useConfirm, useToast } from '@/components/ui';
import { configApi, gmailApi, type ChannelPreferences, type UpdateMeInput } from '@/lib/api';
import { connectGmail } from '@/lib/gmail-auth';
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
  const { user, signOut, updateProfile, refreshUser } = useAuth();
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
  const [gmailAvailable, setGmailAvailable] = useState(false);
  const [connectingGmail, setConnectingGmail] = useState(false);

  // The cap is a business-config value, fetched (not hardcoded) for the note;
  // the same call tells us whether Gmail auto-send is provisioned (Stage 14).
  useEffect(() => {
    let active = true;
    configApi
      .get()
      .then((c) => {
        if (!active) return;
        setSmsCap(c.smsWhatsappMonthlyCap);
        setGmailAvailable(!!c.gmailAutoSendAvailable);
      })
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

  const onConnectGmail = async () => {
    setConnectingGmail(true);
    try {
      const result = await connectGmail();
      if (result === 'connected') {
        await refreshUser();
        toast.show('Gmail connected.');
      } else if (result === 'error') {
        toast.show("Couldn't connect Gmail. Please try again.");
      }
    } catch {
      toast.show("Couldn't connect Gmail. Please try again.");
    } finally {
      setConnectingGmail(false);
    }
  };

  const onDisconnectGmail = async () => {
    const ok = await confirm({
      title: 'Disconnect Gmail?',
      message: 'Auto-send birthday emails will stop until you reconnect.',
      confirmLabel: 'Disconnect',
      cancelLabel: 'Keep',
      destructive: true,
    });
    if (!ok) return;
    try {
      await gmailApi.disconnect();
      await refreshUser();
      toast.show('Gmail disconnected.');
    } catch {
      toast.show("Couldn't disconnect. Please try again.");
    }
  };

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
        <Card
          onPress={() => router.push('/calendar-sync')}
          accessibilityLabel="Calendar sync"
          className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Icon icon={CalendarPlus} size={20} />
            <Text variant="body">Calendar sync</Text>
          </View>
          <Icon icon={ChevronRight} size={20} />
        </Card>
        <Text variant="caption" className="mt-2 text-ink-muted">
          Subscribe to your birthdays in Apple, Google, or Outlook calendars.
        </Text>

        {gmailAvailable ? (
          <>
            <SectionLabel>Auto-send email</SectionLabel>
            <Card>
              <View className="flex-row items-center gap-3">
                <Icon icon={Mail} size={20} />
                <View className="flex-1">
                  <Text variant="body">Gmail account</Text>
                  <Text variant="caption" className="mt-0.5 text-ink-muted">
                    {user?.gmailConnected ? `Connected as ${user.gmailEmail}` : 'Not connected'}
                  </Text>
                </View>
                {user?.gmailConnected ? (
                  <Button variant="ghost" onPress={onDisconnectGmail}>
                    Disconnect
                  </Button>
                ) : (
                  <Button variant="secondary" loading={connectingGmail} onPress={onConnectGmail}>
                    Connect
                  </Button>
                )}
              </View>
            </Card>
            <Text variant="caption" className="mt-2 text-ink-muted">
              Auto-send birthday greetings to friends from your own Gmail. Turn it on for a person
              when you add or edit them.
            </Text>
          </>
        ) : null}

        <SectionLabel>People</SectionLabel>
        <Card
          onPress={() => router.push('/import')}
          accessibilityLabel="Import people"
          className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Icon icon={Upload} size={20} />
            <Text variant="body">Import people</Text>
          </View>
          <Icon icon={ChevronRight} size={20} />
        </Card>

        <SectionLabel>Home screen</SectionLabel>
        <Card
          onPress={() => router.push('/widget-preview')}
          accessibilityLabel="Home screen widget"
          className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Icon icon={LayoutGrid} size={20} />
            <Text variant="body">Home screen widget</Text>
          </View>
          <Icon icon={ChevronRight} size={20} />
        </Card>
        <Text variant="caption" className="mt-2 text-ink-muted">
          Your next 3 events on your phone&apos;s home screen. Add it from the home screen on
          iOS or Android.
        </Text>

        <SectionLabel>Design</SectionLabel>
        <Card
          onPress={() => router.push('/ring-preview')}
          accessibilityLabel="Ring preview"
          className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3">
            <Icon icon={Sparkles} size={20} />
            <Text variant="body">Ring preview</Text>
          </View>
          <Icon icon={ChevronRight} size={20} />
        </Card>

        <View className="mt-8">
          <Button variant="secondary" fullWidth onPress={onLogout}>
            Log out
          </Button>
        </View>
      </ScrollView>
    </Screen>
  );
}
