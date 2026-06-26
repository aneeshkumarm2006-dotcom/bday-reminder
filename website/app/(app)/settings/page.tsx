"use client";

import { useQuery } from "@tanstack/react-query";
import { useTheme } from "next-themes";
import Link from "next/link";
import { CalendarDays, ChevronRight, Upload } from "lucide-react";
import { useState } from "react";

import {
  ChannelToggles,
  LeadTimeChips,
  ReminderTimePicker,
  DEFAULT_CHANNELS,
} from "@/components/app/reminder-prefs";
import { PageHeader } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { TextField } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { configApi, type ChannelPreferences } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/** Settings (FR-19-26) — profile, channels, lead times, reminder time, appearance. */
export default function SettingsPage() {
  const { user, updateProfile, signOut } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const [name, setName] = useState(user?.name ?? "");
  const [phone, setPhone] = useState(user?.phone ?? "");
  const [profileBusy, setProfileBusy] = useState(false);

  const { data: config } = useQuery({ queryKey: ["config"], queryFn: () => configApi.get() });

  if (!user) return null;

  const channels = user.channelPreferences ?? DEFAULT_CHANNELS;
  const leadDays = user.defaultLeadDays ?? [0, 7];
  const reminderTime = user.defaultReminderTime ?? "09:00";

  const persist = async (patch: Parameters<typeof updateProfile>[0], msg = "Saved.") => {
    try {
      await updateProfile(patch);
      toast({ message: msg, tone: "success" });
    } catch {
      toast({ message: "Couldn't save. Try again.", tone: "error" });
    }
  };

  const saveProfile = async () => {
    setProfileBusy(true);
    await persist({ name: name.trim(), phone: phone.trim() || null }, "Profile saved.");
    setProfileBusy(false);
  };

  return (
    <div className="max-w-xl">
      <PageHeader title="Settings" />

      <Section title="Profile">
        <div className="flex flex-col gap-4">
          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} />
          <TextField
            label="Phone"
            type="tel"
            helper="Used for the day-of greeting shortcut."
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <p className="text-sm text-ink-muted">Timezone: {user.timezone ?? "auto"}</p>
          <div>
            <Button onClick={saveProfile} disabled={profileBusy}>
              Save profile
            </Button>
          </div>
        </div>
      </Section>

      <Section title="When to remind you" subtitle="Default lead times for every event.">
        <LeadTimeChips
          value={leadDays}
          onChange={(next) => persist({ defaultLeadDays: next }, "Lead times saved.")}
        />
      </Section>

      <Section title="Reminder time" subtitle="The time of day reminders arrive, in your timezone.">
        <div className="max-w-[12rem]">
          <ReminderTimePicker
            value={reminderTime}
            onChange={(next) => persist({ defaultReminderTime: next }, "Reminder time saved.")}
          />
        </div>
      </Section>

      <Section title="How to reach you">
        <ChannelToggles
          value={channels}
          smsCap={config?.smsWhatsappMonthlyCap ?? null}
          onChange={(next: ChannelPreferences) => persist({ channelPreferences: next })}
        />
      </Section>

      <Section title="Appearance">
        <div className="flex gap-2">
          {(["light", "dark", "system"] as const).map((t) => (
            <Chip key={t} selected={theme === t} onClick={() => setTheme(t)}>
              {t[0].toUpperCase() + t.slice(1)}
            </Chip>
          ))}
        </div>
      </Section>

      <Section title="More">
        <div className="flex flex-col divide-y divide-border-subtle">
          <SettingsLink href="/settings/calendar" icon={CalendarDays} label="Calendar sync" />
          <SettingsLink href="/import" icon={Upload} label="Import people" />
        </div>
      </Section>

      <div className="mt-8 border-t border-border-subtle pt-6">
        <Button variant="secondary" onClick={() => void signOut()}>
          Log out
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8 first:mt-0">
      <h2 className="font-display text-lg font-semibold text-ink">{title}</h2>
      {subtitle && <p className="mb-3 mt-0.5 text-sm text-ink-secondary">{subtitle}</p>}
      <div className={subtitle ? "" : "mt-3"}>{children}</div>
    </section>
  );
}

function SettingsLink({
  href,
  icon: Icon,
  label,
}: {
  href: string;
  icon: typeof CalendarDays;
  label: string;
}) {
  return (
    <Link href={href} className="flex items-center gap-3 py-3 text-ink hover:text-biro">
      <Icon size={19} className="text-ink-muted" aria-hidden="true" />
      <span className="flex-1 font-medium">{label}</span>
      <ChevronRight size={18} className="text-ink-muted" aria-hidden="true" />
    </Link>
  );
}
