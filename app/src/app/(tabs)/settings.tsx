import { useRouter } from 'expo-router';
import {
  CalendarPlus,
  ChevronRight,
  CloudDownload,
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
import {
  Button,
  Card,
  Chip,
  Icon,
  Screen,
  Text,
  TextField,
  useConfirm,
  useToast,
} from '@/components/ui';
import {
  configApi,
  gmailApi,
  googleImportApi,
  type ChannelPreferences,
  type UpdateMeInput,
} from '@/lib/api';
import { connectGmail } from '@/lib/gmail-auth';
import { connectGoogleImport } from '@/lib/google-import-auth';
import { formatNanp } from '@/lib/phone';
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
  const { user, signOut, deleteAccount, updateProfile, refreshUser } = useAuth();
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
  const [googleImportAvailable, setGoogleImportAvailable] = useState(false);
  const [connectingGoogleImport, setConnectingGoogleImport] = useState(false);

  // Editable profile (name signs auto-send SMS and shows to shared-list
  // members). Fields are local drafts, seeded once the user hydrates - unlike
  // the toggles above they'd lose in-progress typing if they read from `user`.
  const [name, setName] = useState(user?.name ?? '');
  const [phone, setPhone] = useState(formatNanp(user?.phone));
  const [profileSeeded, setProfileSeeded] = useState(!!user);
  const [nameError, setNameError] = useState<string | undefined>(undefined);
  const [savingProfile, setSavingProfile] = useState(false);

  // Seed once during render (not in an effect) when the user hydrates after
  // mount — React re-renders immediately with the seeded values.
  if (user && !profileSeeded) {
    setName(user.name);
    setPhone(formatNanp(user.phone));
    setProfileSeeded(true);
  }

  const onSaveProfile = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError('Add your name — it signs your greetings and shows on shared lists.');
      return;
    }
    setNameError(undefined);
    setSavingProfile(true);
    try {
      await updateProfile({ name: trimmedName, phone: phone.trim() ? phone.trim() : null });
      toast.show('Profile saved.');
    } catch {
      toast.show("Couldn't save that. Check your connection and try again.");
    } finally {
      setSavingProfile(false);
    }
  };

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
        setGoogleImportAvailable(!!c.googleImportAvailable);
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

  const onConnectGoogleImport = async () => {
    setConnectingGoogleImport(true);
    try {
      const result = await connectGoogleImport();
      if (result === 'connected') {
        await refreshUser();
        toast.show('Google connected. Import from the Import people screen.');
      } else if (result === 'error') {
        toast.show("Couldn't connect Google. Please try again.");
      }
    } catch {
      toast.show("Couldn't connect Google. Please try again.");
    } finally {
      setConnectingGoogleImport(false);
    }
  };

  const onDisconnectGoogleImport = async () => {
    const ok = await confirm({
      title: 'Disconnect Google?',
      message: 'You can reconnect any time you want to import again.',
      confirmLabel: 'Disconnect',
      cancelLabel: 'Keep',
      destructive: true,
    });
    if (!ok) return;
    try {
      await googleImportApi.disconnect();
      await refreshUser();
      toast.show('Google disconnected.');
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

  const [deletingAccount, setDeletingAccount] = useState(false);
  const onDeleteAccount = async () => {
    const ok = await confirm({
      title: 'Delete account?',
      message:
        'This permanently deletes your account and everything in it — people, reminders, notes, gift notes, shared lists, and connected accounts. This can’t be undone.',
      confirmLabel: 'Delete everything',
      cancelLabel: 'Keep my account',
      destructive: true,
    });
    if (!ok) return;
    setDeletingAccount(true);
    try {
      // On success the auth status flips to unauthenticated and the app routes
      // back to sign-in, so this screen unmounts - no need to reset the flag.
      await deleteAccount();
    } catch {
      setDeletingAccount(false);
      toast.show("Couldn't delete your account. Check your connection and try again.");
    }
  };

  return (
    <Screen>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
        <View className="pb-2 pt-3">
          <Text variant="title">Settings</Text>
        </View>

        <SectionLabel>Account</SectionLabel>
        <Card>
          <View className="gap-4">
            <TextField
              label="Name"
              value={name}
              onChangeText={setName}
              placeholder="Your name"
              error={nameError}
            />
            <TextField
              label="Phone"
              optional
              value={phone}
              onChangeText={setPhone}
              placeholder="(555) 123-4567"
              keyboardType="phone-pad"
              hint="Used for the day-of greeting shortcut."
            />
            <View>
              {user?.email ? (
                <Text variant="caption" className="text-ink-muted">
                  Signed in as {user.email}
                </Text>
              ) : null}
              <Text variant="caption" className="mt-0.5 text-ink-muted">
                Timezone: {user?.timezone ?? 'auto'}
              </Text>
            </View>
            <Button onPress={onSaveProfile} loading={savingProfile}>
              Save profile
            </Button>
          </View>
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

        {googleImportAvailable ? (
          <>
            <Card className="mt-3">
              <View className="flex-row items-center gap-3">
                <Icon icon={CloudDownload} size={20} />
                <View className="flex-1">
                  <Text variant="body">Google import</Text>
                  <Text variant="caption" className="mt-0.5 text-ink-muted">
                    {user?.googleImportConnected
                      ? `Connected as ${user.googleImportEmail}`
                      : 'Not connected'}
                  </Text>
                </View>
                {user?.googleImportConnected ? (
                  <Button variant="ghost" onPress={onDisconnectGoogleImport}>
                    Disconnect
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    loading={connectingGoogleImport}
                    onPress={onConnectGoogleImport}>
                    Connect
                  </Button>
                )}
              </View>
            </Card>
            <Text variant="caption" className="mt-2 text-ink-muted">
              Bulk-import birthdays + anniversaries from Google Calendar and Contacts. We only ask
              for access when you import, and you review everything first.
            </Text>
          </>
        ) : null}

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

        <SectionLabel>Danger zone</SectionLabel>
        <Card>
          <Text variant="body">Delete account</Text>
          <Text variant="caption" className="mt-1 text-ink-muted">
            Permanently erase your account and all of its data. This can’t be undone.
          </Text>
          <View className="mt-3">
            <Button
              variant="destructive"
              fullWidth
              loading={deletingAccount}
              onPress={onDeleteAccount}>
              Delete account
            </Button>
          </View>
        </Card>
      </ScrollView>
    </Screen>
  );
}
