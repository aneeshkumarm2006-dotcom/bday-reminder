"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ChannelToggles, LeadTimeChips, DEFAULT_CHANNELS } from "@/components/app/reminder-prefs";
import { Ring } from "@/components/ring";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import type { ChannelPreferences } from "@/lib/api";
import { useAuth } from "@/providers/auth-provider";

/**
 * First-run onboarding (FR-2/3). Confirms the reminder defaults, then marks the
 * account onboarded (one-way) and sends the user to add their first person.
 */
export default function OnboardingPage() {
  const { user, updateProfile } = useAuth();
  const router = useRouter();
  const { toast } = useToast();

  const [leadDays, setLeadDays] = useState<number[]>(user?.defaultLeadDays ?? [0, 7]);
  const [channels, setChannels] = useState<ChannelPreferences>(
    user?.channelPreferences ?? DEFAULT_CHANNELS,
  );
  const [busy, setBusy] = useState(false);

  const finish = async (next: "add" | "dashboard") => {
    setBusy(true);
    try {
      await updateProfile({
        onboarded: true,
        defaultLeadDays: leadDays,
        channelPreferences: channels,
      });
      router.replace(next === "add" ? "/people/new" : "/reminders");
    } catch {
      toast({ message: "Couldn't save your settings. Try again.", tone: "error" });
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto flex min-h-dvh max-w-lg flex-col justify-center px-5 py-12">
      <div className="mb-8 flex flex-col items-center text-center">
        <Ring day={12} month="Jun" size="xl" state="today" />
        <h1 className="mt-6 font-display text-3xl font-semibold text-ink">
          Welcome, {user?.name?.split(" ")[0] ?? "there"}
        </h1>
        <p className="mt-2 text-ink-secondary">
          Let&apos;s set how you want to be reminded. You can change this anytime in Settings.
        </p>
      </div>

      <div className="rounded-2xl border border-border-subtle bg-surface p-6">
        <section>
          <h2 className="font-display text-lg font-semibold text-ink">When should we remind you?</h2>
          <p className="mb-3 mt-1 text-sm text-ink-secondary">Pick one or more lead times.</p>
          <LeadTimeChips value={leadDays} onChange={setLeadDays} />
        </section>

        <section className="mt-6 border-t border-border-subtle pt-4">
          <h2 className="font-display text-lg font-semibold text-ink">How should we reach you?</h2>
          <ChannelToggles value={channels} onChange={setChannels} smsCap={null} />
        </section>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button size="lg" className="flex-1" onClick={() => finish("add")} disabled={busy}>
          Add your first person
        </Button>
        <Button size="lg" variant="secondary" onClick={() => finish("dashboard")} disabled={busy}>
          Skip for now
        </Button>
      </div>
    </div>
  );
}
