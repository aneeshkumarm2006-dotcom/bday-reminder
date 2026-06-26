"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/app/page-header";
import { ReminderCard } from "@/components/app/reminder-card";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBlock } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import { remindersApi, type ReminderItem, type SnoozePreset } from "@/lib/api";
import { greetingText, greetingUrl } from "@/lib/greeting";

/** The persistent in-app reminder feed (FR-27) — mark done, snooze, send greeting. */
export default function RemindersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["reminders"],
    queryFn: () => remindersApi.list(),
  });

  const done = useMutation({
    mutationFn: (id: string) => remindersApi.markDone(id),
    onMutate: (id) => setBusyId(id),
    onSuccess: () => {
      toast({ message: "Marked as done.", tone: "success" });
      qc.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: () => toast({ message: "Couldn't update. Try again.", tone: "error" }),
    onSettled: () => setBusyId(null),
  });

  const snooze = useMutation({
    mutationFn: ({ id, preset }: { id: string; preset: SnoozePreset }) =>
      remindersApi.snooze(id, preset),
    onMutate: ({ id }) => setBusyId(id),
    onSuccess: () => {
      toast({ message: "Snoozed.", tone: "success" });
      qc.invalidateQueries({ queryKey: ["reminders"] });
    },
    onError: () => toast({ message: "Couldn't snooze. Try again.", tone: "error" }),
    onSettled: () => setBusyId(null),
  });

  const greet = (item: ReminderItem) => {
    window.open(greetingUrl(item), "_blank", "noopener,noreferrer");
  };

  const copy = async (item: ReminderItem) => {
    try {
      await navigator.clipboard.writeText(greetingText(item));
      toast({ message: "Greeting copied.", tone: "success" });
    } catch {
      toast({ message: "Couldn't copy. Select and copy manually.", tone: "error" });
    }
  };

  if (isLoading) return <LoadingBlock />;
  if (isError || !data) {
    return <p className="text-ink-secondary">Couldn&apos;t load your reminders. Refresh to try again.</p>;
  }

  return (
    <div>
      <PageHeader title="Reminders" subtitle="Everything due, in one place." />

      {data.items.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          body="When a birthday or event is coming up, your reminders show up here."
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {data.items.map((item) => (
            <ReminderCard
              key={item.id}
              item={item}
              busy={busyId === item.id}
              onGreet={() => greet(item)}
              onCopy={() => copy(item)}
              onDone={() => done.mutate(item.id)}
              onSnooze={(preset) => snooze.mutate({ id: item.id, preset })}
            />
          ))}
        </div>
      )}
    </div>
  );
}
