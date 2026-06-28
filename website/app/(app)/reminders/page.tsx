"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { PageHeader } from "@/components/app/page-header";
import { PersonCard } from "@/components/app/person-card";
import { ReminderCard } from "@/components/app/reminder-card";
import { buttonVariants } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState } from "@/components/ui/empty-state";
import { LoadingBlock } from "@/components/ui/spinner";
import { useToast } from "@/components/ui/toast";
import {
  peopleApi,
  remindersApi,
  type ReminderItem,
  type SnoozePreset,
  type UpcomingGroup,
  type UpcomingItem,
} from "@/lib/api";
import { greetingText, greetingUrl } from "@/lib/greeting";
import { cn } from "@/lib/utils";

/**
 * Reminders — the post-login home and the single "what's happening" surface
 * (DESIGN.md §8.3). Two sections: "Needs your attention" (the persistent in-app
 * reminders, with greeting / done / snooze) then "Upcoming" (the computed feed,
 * grouped This week / This month / Later). An occurrence already shown as an
 * active reminder is dropped from Upcoming so it never appears twice. A
 * relationship-tag chip row filters both sections.
 */

const GROUP_ORDER: UpcomingGroup[] = ["This week", "This month", "Later"];

/** Dedup key shared by reminders + upcoming: event + the calendar date (UTC). */
function occKey(eventId: string, occurrenceDate: string): string {
  return `${eventId}|${occurrenceDate.slice(0, 10)}`;
}

export default function RemindersPage() {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);

  const reminders = useQuery({ queryKey: ["reminders"], queryFn: () => remindersApi.list() });
  const upcoming = useQuery({ queryKey: ["upcoming"], queryFn: () => peopleApi.upcoming() });

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

  if (reminders.isLoading || upcoming.isLoading) return <LoadingBlock />;
  if (reminders.isError || !reminders.data || upcoming.isError || !upcoming.data) {
    return <p className="text-ink-secondary">Couldn&apos;t load your reminders. Refresh to try again.</p>;
  }

  const reminderItems = reminders.data.items;
  // An occurrence with an active reminder shows only in the attention section.
  const activeKeys = new Set(reminderItems.map((r) => occKey(r.event.id, r.occurrenceDate)));
  const upcomingItems = upcoming.data.items.filter(
    (i) => !activeKeys.has(occKey(i.eventId, i.occurrenceDate)),
  );

  if (reminderItems.length === 0 && upcomingItems.length === 0) {
    return (
      <div>
        <PageHeader title="Reminders" subtitle="Everything due and coming up, in one place." />
        <EmptyState
          icon={Bell}
          title="You're all caught up"
          body="Add the people you don't want to forget — their birthdays and reminders show up here."
          action={
            <Link href="/people/new" className={buttonVariants()}>
              <Plus aria-hidden="true" />
              Add your first person
            </Link>
          }
        />
      </div>
    );
  }

  // Tag chips: the union of the Upcoming feed's tags and any tags on reminder
  // people, so filtering applies across both sections.
  const tags = [
    ...new Set([
      ...upcoming.data.tags,
      ...reminderItems.map((r) => r.person.relationshipTag).filter((x): x is string => !!x),
    ]),
  ].sort((a, b) => a.localeCompare(b));
  const effectiveTag = tag && tags.includes(tag) ? tag : null;

  const visibleReminders = effectiveTag
    ? reminderItems.filter((r) => r.person.relationshipTag === effectiveTag)
    : reminderItems;
  const visibleUpcoming = effectiveTag
    ? upcomingItems.filter((i) => i.relationshipTag === effectiveTag)
    : upcomingItems;

  const groups = GROUP_ORDER.map((g) => ({
    group: g,
    items: visibleUpcoming.filter((i) => i.group === g),
  })).filter((g) => g.items.length > 0);

  const nothingForTag = visibleReminders.length === 0 && groups.length === 0;

  return (
    <div>
      <PageHeader
        title="Reminders"
        subtitle="Everything due and coming up, in one place."
        action={
          <Link href="/people/new" className={cn(buttonVariants(), "hidden sm:inline-flex")}>
            <Plus aria-hidden="true" />
            Add person
          </Link>
        }
      />

      {tags.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          <Chip selected={effectiveTag === null} onClick={() => setTag(null)}>
            All
          </Chip>
          {tags.map((t) => (
            <Chip key={t} selected={effectiveTag === t} onClick={() => setTag(t)}>
              {t}
            </Chip>
          ))}
        </div>
      )}

      {nothingForTag ? (
        <p className="text-ink-secondary">Nothing tagged “{effectiveTag}” right now.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {visibleReminders.length > 0 && (
            <section>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">
                Needs your attention
              </h2>
              <div className="flex flex-col gap-2.5">
                {visibleReminders.map((item) => (
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
            </section>
          )}

          {groups.map(({ group, items }) => (
            <UpcomingSection key={group} title={group} items={items} />
          ))}
        </div>
      )}
    </div>
  );
}

function UpcomingSection({ title, items }: { title: string; items: UpcomingItem[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-muted">{title}</h2>
      <div className="flex flex-col gap-2.5">
        {items.map((item) => (
          <PersonCard key={`${item.personId}-${item.eventId}`} item={item} />
        ))}
      </div>
    </section>
  );
}
