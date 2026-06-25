import { useRouter } from 'expo-router';
import { CalendarHeart, ChevronRight, UserPlus, Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, View } from 'react-native';

import {
  ChannelToggles,
  DEFAULT_CHANNELS,
  LeadTimeChips,
} from '@/components/reminder-prefs';
import { Button, Card, Icon, Label, Screen, Text, useToast } from '@/components/ui';
import { cn, focusRing } from '@/lib/cn';
import { configApi, type ChannelPreferences } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';
import { useTokens } from '@/theme/theme-provider';

/**
 * First-run onboarding (TODO Stage 7; FR-2/3). After signup we land here once:
 * confirm the default reminder lead time(s) + channel(s) - sensible defaults are
 * pre-selected so it's skippable without friction - then pick a fast way to add
 * people (import contacts or add manually). Any choice persists
 * the defaults and marks onboarding done so we don't show this again. The nav
 * guard in `_layout.tsx` routes a not-yet-onboarded user here.
 */

type Destination = 'contacts' | 'manual' | 'skip';

export default function OnboardingScreen() {
  const router = useRouter();
  const toast = useToast();
  const t = useTokens();
  const { user, updateProfile } = useAuth();

  // Seed from the user's current defaults (the sensible pre-selection, FR-3).
  const [leadDays, setLeadDays] = useState<number[]>(user?.defaultLeadDays ?? [0, 7]);
  const [channels, setChannels] = useState<ChannelPreferences>(
    user?.channelPreferences ?? DEFAULT_CHANNELS,
  );
  const [smsCap, setSmsCap] = useState<number | null>(null);
  const [busy, setBusy] = useState<Destination | null>(null);

  useEffect(() => {
    let active = true;
    configApi
      .get()
      .then((c) => active && setSmsCap(c.smsWhatsappMonthlyCap))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // Persist the chosen defaults + mark onboarding complete, then head to the
  // chosen next step. Establish the tab home first so import/add can go back.
  const go = async (dest: Destination) => {
    if (busy) return;
    setBusy(dest);
    try {
      await updateProfile({
        defaultLeadDays: leadDays,
        channelPreferences: channels,
        onboarded: true,
      });
    } catch {
      toast.show("Couldn't save your preferences. Check your connection and try again.");
      setBusy(null);
      return;
    }
    router.replace('/');
    if (dest === 'contacts') router.push({ pathname: '/import', params: { source: 'contacts' } });
    else if (dest === 'manual') router.push('/add-person');
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row items-center justify-end pt-2">
        <Pressable
          onPress={() => go('skip')}
          disabled={!!busy}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Skip onboarding"
          className={cn('rounded-sm', focusRing)}>
          <Text variant="label" className="text-ink-muted">
            Skip
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 32, gap: 24 }}>
        <View className="items-center gap-3 pt-4">
          <View className="h-14 w-14 items-center justify-center rounded-full bg-biro-tint">
            <Icon icon={CalendarHeart} size={26} color={t.biro} />
          </View>
          <Text variant="title" className="text-center">
            {user?.name ? `Welcome, ${user.name.split(' ')[0]}.` : 'Welcome.'}
          </Text>
          <Text variant="body" className="text-center text-ink-secondary">
            Two quick choices, then you can start adding people. You can change
            either of these later in Settings.
          </Text>
        </View>

        <View className="gap-3">
          <Label>Remind me ahead of time</Label>
          <LeadTimeChips value={leadDays} onChange={setLeadDays} />
        </View>

        <View className="gap-3">
          <Label>Notify me by</Label>
          <ChannelToggles
            value={channels}
            onChange={setChannels}
            smsCap={smsCap}
            zeroMessage="You won't be notified anywhere. Reminders still appear in your in-app feed."
          />
        </View>

        <View className="gap-3">
          <Label>Add your people</Label>
          {Platform.OS !== 'web' ? (
            <ChoiceCard
              icon={Users}
              title="Import from contacts"
              body="Pull in everyone who has a birthday saved."
              onPress={() => go('contacts')}
              loading={busy === 'contacts'}
              disabled={!!busy}
            />
          ) : null}
          <ChoiceCard
            icon={UserPlus}
            title="Add someone manually"
            body="Enter one person to start."
            onPress={() => go('manual')}
            loading={busy === 'manual'}
            disabled={!!busy}
          />
        </View>

        <Button variant="ghost" fullWidth loading={busy === 'skip'} onPress={() => go('skip')}>
          I&apos;ll add people later
        </Button>
      </ScrollView>
    </Screen>
  );
}

/** A tappable card for an onboarding next-step (icon · title/body · chevron). */
function ChoiceCard({
  icon,
  title,
  body,
  onPress,
  loading,
  disabled,
}: {
  icon: typeof Users;
  title: string;
  body: string;
  onPress: () => void;
  loading: boolean;
  disabled: boolean;
}) {
  const tint = useTokens().biro;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={title}
      className={cn('rounded-lg', focusRing)}>
      <Card className={`flex-row items-center gap-3 ${disabled && !loading ? 'opacity-60' : ''}`}>
        <View className="h-10 w-10 items-center justify-center rounded-full bg-surface-sunken">
          <Icon icon={icon} size={20} />
        </View>
        <View className="flex-1">
          <Text variant="cardName">{title}</Text>
          <Text variant="caption" className="mt-0.5 text-ink-secondary">
            {body}
          </Text>
        </View>
        {loading ? <ActivityIndicator color={tint} /> : <Icon icon={ChevronRight} size={20} />}
      </Card>
    </Pressable>
  );
}
