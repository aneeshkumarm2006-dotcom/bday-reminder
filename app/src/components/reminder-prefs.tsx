import { Bell, Mail, MessageCircle, Minus, Plus, Smartphone } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Chip, Icon, Select, Sheet, Text, ToggleRow, type SelectOption } from '@/components/ui';
import { cn, focusRing } from '@/lib/cn';
import type { ChannelKey, ChannelPreferences } from '@/lib/api';

/**
 * Reminder-preference controls (DESIGN.md §8.4/§8.5), shared by the global
 * Settings screen and the per-event override in Add/Edit person so both render
 * the identical chip + toggle set (FR-19/20/21/24/26/56). Pure controlled
 * components - they hold no server state; the parent persists the change.
 */

// --- Lead-time chips (§8.4, FR-19/20) ---------------------------------------

const LEAD_PRESETS: { label: string; days: number }[] = [
  { label: 'On the day', days: 0 },
  { label: '1 day', days: 1 },
  { label: '3 days', days: 3 },
  { label: '1 week', days: 7 },
  { label: '2 weeks', days: 14 },
];
const PRESET_DAYS = new Set(LEAD_PRESETS.map((p) => p.days));

/** Label a custom lead time that isn't one of the named presets. */
function leadLabel(days: number): string {
  if (days === 0) return 'On the day';
  if (days === 7) return '1 week';
  if (days === 14) return '2 weeks';
  return `${days} day${days === 1 ? '' : 's'}`;
}

const sortedUnique = (days: number[]): number[] => [...new Set(days)].sort((a, b) => a - b);

export function LeadTimeChips({
  value,
  onChange,
}: {
  value: number[];
  onChange: (next: number[]) => void;
}) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customDays, setCustomDays] = useState(2);

  const customValues = value.filter((d) => !PRESET_DAYS.has(d)).sort((a, b) => a - b);

  const toggle = (days: number) => {
    onChange(
      value.includes(days) ? value.filter((d) => d !== days) : sortedUnique([...value, days]),
    );
  };

  const addCustom = () => {
    onChange(sortedUnique([...value, customDays]));
    setCustomOpen(false);
  };

  return (
    <View className="flex-row flex-wrap gap-2">
      {LEAD_PRESETS.map((p) => (
        <Chip key={p.days} label={p.label} selected={value.includes(p.days)} onPress={() => toggle(p.days)} />
      ))}
      {customValues.map((d) => (
        <Chip key={d} label={leadLabel(d)} selected onPress={() => toggle(d)} />
      ))}
      <Chip label="Custom" onPress={() => setCustomOpen(true)} />

      <Sheet visible={customOpen} onClose={() => setCustomOpen(false)} title="Custom lead time">
        <View className="gap-5 pb-2">
          <View className="flex-row items-center justify-center gap-8">
            <Stepper icon={Minus} onPress={() => setCustomDays((d) => Math.max(1, d - 1))} label="Fewer days" />
            <View className="items-center">
              <Text variant="ringLg" tabularNums>
                {String(customDays)}
              </Text>
              <Text variant="caption" className="mt-1">
                {customDays === 1 ? 'day before' : 'days before'}
              </Text>
            </View>
            <Stepper icon={Plus} onPress={() => setCustomDays((d) => Math.min(365, d + 1))} label="More days" />
          </View>
          <Button fullWidth onPress={addCustom}>
            Add lead time
          </Button>
        </View>
      </Sheet>
    </View>
  );
}

function Stepper({
  icon,
  onPress,
  label,
}: {
  icon: typeof Plus;
  onPress: () => void;
  label: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn(
        'h-11 w-11 items-center justify-center rounded-md border border-border-strong bg-surface active:scale-[0.96]',
        focusRing,
      )}>
      <Icon icon={icon} size={20} />
    </Pressable>
  );
}

// --- Channel toggles + fair-use + zero-channel guard (§8.5, FR-23/26/56) -----

const CHANNELS: { key: ChannelKey; label: string; helper?: string; icon: typeof Bell }[] = [
  { key: 'push', label: 'Push', helper: 'On your phone and devices', icon: Smartphone },
  { key: 'email', label: 'Email', icon: Mail },
  { key: 'sms', label: 'Text message (SMS)', icon: MessageCircle },
  { key: 'inApp', label: 'In-app', helper: 'Always kept in your reminders feed', icon: Bell },
];

export function ChannelToggles({
  value,
  onChange,
  smsCap,
  zeroMessage = "You won't be reminded for this event.",
}: {
  value: ChannelPreferences;
  onChange: (next: ChannelPreferences) => void;
  /** Monthly SMS cap from config; null while still loading (FR-56). */
  smsCap: number | null;
  zeroMessage?: string;
}) {
  const allOff = !value.push && !value.email && !value.sms && !value.inApp;
  const set = (key: ChannelKey, on: boolean) => onChange({ ...value, [key]: on });

  return (
    <View>
      {CHANNELS.map((c) => (
        <View key={c.key}>
          <ToggleRow
            title={c.label}
            helper={c.helper}
            icon={c.icon}
            value={value[c.key]}
            onValueChange={(on) => set(c.key, on)}
          />
          {c.key === 'sms' && value.sms ? <FairUseNote cap={smsCap} /> : null}
        </View>
      ))}

      {allOff ? (
        <NoticeBox>
          <Text variant="caption" className="text-warn-fg">
            {zeroMessage}
          </Text>
          <Pressable
            onPress={() => set('push', true)}
            accessibilityRole="button"
            hitSlop={6}
            className={cn('mt-2 self-start rounded-sm', focusRing)}>
            <Text variant="label" className="text-biro">
              Turn on push
            </Text>
          </Pressable>
        </NoticeBox>
      ) : null}
    </View>
  );
}

/** Persistent fair-use note under SMS - number read from config, not hardcoded. */
function FairUseNote({ cap }: { cap: number | null }) {
  const copy =
    cap != null
      ? `Up to ${cap} SMS reminders a month to keep the app free. After the cap, reminders switch to push and email automatically.`
      : 'SMS reminders are capped each month to keep the app free. After the cap, reminders switch to push and email automatically.';
  return (
    <NoticeBox>
      <Text variant="caption" className="text-warn-fg">
        {copy}
      </Text>
    </NoticeBox>
  );
}

/** Warning-tinted inline box (DESIGN.md §3.1 warning, §8.5). */
function NoticeBox({ children }: { children: React.ReactNode }) {
  return <View className="mb-1 mt-1 rounded-sm bg-warn-bg p-3">{children}</View>;
}

// --- Reminder time-of-day picker (§8.4, FR-22) ------------------------------

/** 12-hour label for an HH:mm slot. */
function timeLabel(hour: number, minute: number): string {
  const period = hour < 12 ? 'AM' : 'PM';
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(minute).padStart(2, '0')} ${period}`;
}

/** Half-hour slots across the day, value "HH:mm" (matches the backend format). */
const TIME_OPTIONS: SelectOption[] = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? 0 : 30;
  const value = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return { label: timeLabel(hour, minute), value };
});

export function ReminderTimePicker({
  value,
  onChange,
  inheritLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  /** When set, adds a leading "inherit" option (value "") that clears a per-event override. */
  inheritLabel?: string;
}) {
  const base = inheritLabel ? [{ label: inheritLabel, value: '' }, ...TIME_OPTIONS] : TIME_OPTIONS;
  // Guard against a stored value off the half-hour grid so it still shows.
  const options = base.some((o) => o.value === value) ? base : [{ label: value, value }, ...base];
  return <Select value={value} options={options} onChange={onChange} placeholder="9:00 AM" />;
}

/**
 * Label for the per-event "use my default" option, e.g. "Default (9:00 AM)",
 * built from the user's global `defaultReminderTime` so it stays accurate.
 */
export function defaultTimeInheritLabel(hhmm: string | undefined): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm ?? '09:00');
  const hour = m ? Number(m[1]) : 9;
  const minute = m ? Number(m[2]) : 0;
  return `Default (${timeLabel(hour, minute)})`;
}

/** Default channel prefs to seed a new override from (mirrors the User default). */
export const DEFAULT_CHANNELS: ChannelPreferences = {
  push: true,
  email: true,
  sms: false,
  inApp: true,
};
