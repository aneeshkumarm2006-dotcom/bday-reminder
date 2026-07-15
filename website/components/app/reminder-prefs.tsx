"use client";

import { Bell, Mail, MessageCircle, Smartphone } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ToggleRow } from "@/components/ui/switch";
import type { ChannelKey, ChannelPreferences } from "@/lib/api";
import { TIMEZONE_OPTIONS, type TimeZoneOption, zoneOffsetLabel } from "@/lib/timezones";

/**
 * Reminder-preference controls (DESIGN.md §8.4/§8.5), shared by the Settings
 * page and the per-event override in Add/Edit person (FR-19/20/21/24/26/56).
 * Pure controlled components — the parent persists the change. Web port of the
 * app's reminder-prefs; push is flagged mobile-only since the browser can't
 * register for push.
 */

const LEAD_PRESETS: { label: string; days: number }[] = [
  { label: "On the day", days: 0 },
  { label: "1 day", days: 1 },
  { label: "3 days", days: 3 },
  { label: "1 week", days: 7 },
  { label: "2 weeks", days: 14 },
];
const PRESET_DAYS = new Set(LEAD_PRESETS.map((p) => p.days));

function leadLabel(days: number): string {
  if (days === 0) return "On the day";
  if (days === 7) return "1 week";
  if (days === 14) return "2 weeks";
  return `${days} day${days === 1 ? "" : "s"}`;
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

  const toggle = (days: number) =>
    onChange(value.includes(days) ? value.filter((d) => d !== days) : sortedUnique([...value, days]));

  return (
    <div className="flex flex-wrap gap-2">
      {LEAD_PRESETS.map((p) => (
        <Chip key={p.days} selected={value.includes(p.days)} onClick={() => toggle(p.days)}>
          {p.label}
        </Chip>
      ))}
      {customValues.map((d) => (
        <Chip key={d} selected onClick={() => toggle(d)}>
          {leadLabel(d)}
        </Chip>
      ))}
      <Chip onClick={() => setCustomOpen(true)}>Custom…</Chip>

      <Dialog open={customOpen} onClose={() => setCustomOpen(false)} title="Custom lead time">
        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="mb-1.5 block text-sm font-medium text-ink-secondary">Days before</label>
            <Input
              type="number"
              min={1}
              max={365}
              value={customDays}
              onChange={(e) => setCustomDays(Math.max(1, Math.min(365, Number(e.target.value) || 1)))}
            />
          </div>
          <Button
            onClick={() => {
              onChange(sortedUnique([...value, customDays]));
              setCustomOpen(false);
            }}
          >
            Add
          </Button>
        </div>
      </Dialog>
    </div>
  );
}

const CHANNELS: { key: ChannelKey; label: string; helper?: string; icon: typeof Bell }[] = [
  { key: "push", label: "Push", helper: "On the mobile app only", icon: Smartphone },
  { key: "email", label: "Email", icon: Mail },
  { key: "sms", label: "Text message (SMS)", icon: MessageCircle },
  { key: "inApp", label: "In-app", helper: "Always kept in your reminders feed", icon: Bell },
];

export function ChannelToggles({
  value,
  onChange,
  smsCap,
  zeroMessage = "You won't be reminded for this event.",
}: {
  value: ChannelPreferences;
  onChange: (next: ChannelPreferences) => void;
  smsCap: number | null;
  zeroMessage?: string;
}) {
  const allOff = !value.push && !value.email && !value.sms && !value.inApp;
  const set = (key: ChannelKey, on: boolean) => onChange({ ...value, [key]: on });

  return (
    <div className="divide-y divide-border-subtle">
      {CHANNELS.map((c) => (
        <div key={c.key}>
          <ToggleRow
            label={c.label}
            description={c.helper}
            checked={value[c.key]}
            onCheckedChange={(on) => set(c.key, on)}
          />
          {c.key === "sms" && value.sms && (
            <p className="mb-2 rounded-sm bg-warn-bg p-3 text-xs text-warn-fg">
              {smsCap != null
                ? `Up to ${smsCap} SMS reminders a month to keep the app free. After the cap, reminders switch to email automatically.`
                : "SMS reminders are capped each month to keep the app free. After the cap, reminders switch to email automatically."}
            </p>
          )}
        </div>
      ))}

      {allOff && (
        <div className="mt-1 rounded-sm bg-warn-bg p-3">
          <p className="text-xs text-warn-fg">{zeroMessage}</p>
          <button
            type="button"
            onClick={() => set("email", true)}
            className="mt-2 text-sm font-medium text-biro"
          >
            Turn on email
          </button>
        </div>
      )}
    </div>
  );
}

function timeLabel(hour: number, minute: number): string {
  const period = hour < 12 ? "AM" : "PM";
  const display = hour % 12 === 0 ? 12 : hour % 12;
  return `${display}:${String(minute).padStart(2, "0")} ${period}`;
}

const TIME_OPTIONS = Array.from({ length: 48 }, (_, i) => {
  const hour = Math.floor(i / 2);
  const minute = i % 2 === 0 ? 0 : 30;
  const value = `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
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
  const base = inheritLabel ? [{ label: inheritLabel, value: "" }, ...TIME_OPTIONS] : TIME_OPTIONS;
  const options = base.some((o) => o.value === value) ? base : [{ label: value, value }, ...base];
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

/**
 * Timezone picker for the auto-send "send at this time in this zone" control.
 * `value` is an IANA id ("" = inherit the account timezone). A stored value that
 * isn't in the curated list is prepended so it still shows (same guard as the
 * time picker). The live GMT offset is appended to each label as a hint.
 */
export function TimeZonePicker({
  value,
  onChange,
  inheritLabel,
}: {
  value: string;
  onChange: (next: string) => void;
  /** Leading "inherit" option (value ""), e.g. "My timezone (Asia/Kolkata)". */
  inheritLabel: string;
}) {
  const withOffset = (o: TimeZoneOption) => {
    const off = zoneOffsetLabel(o.id);
    return off ? `${o.label} · ${off}` : o.label;
  };
  const base = [
    { label: inheritLabel, value: "" },
    ...TIMEZONE_OPTIONS.map((o) => ({ label: withOffset(o), value: o.id })),
  ];
  const options = base.some((o) => o.value === value)
    ? base
    : [...base, { label: value, value }];
  return (
    <Select value={value} onChange={(e) => onChange(e.target.value)}>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </Select>
  );
}

/** Bare 12-hour label for an "HH:mm" (e.g. "9:00 AM"), for use in prose. Falls back to 9:00 AM. */
export function friendlyTimeLabel(hhmm: string | undefined): string {
  const m = /^(\d{2}):(\d{2})$/.exec(hhmm ?? "09:00");
  const hour = m ? Number(m[1]) : 9;
  const minute = m ? Number(m[2]) : 0;
  return timeLabel(hour, minute);
}

/**
 * Label for the per-event "use my default" option, e.g. "Default (9:00 AM)",
 * built from the user's global `defaultReminderTime` so it stays accurate.
 */
export function defaultTimeInheritLabel(hhmm: string | undefined): string {
  return `Default (${friendlyTimeLabel(hhmm)})`;
}

export const DEFAULT_CHANNELS: ChannelPreferences = {
  push: true,
  email: false,
  sms: false,
  inApp: true,
};
