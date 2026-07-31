"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Chip } from "@/components/ui/chip";
import { useToast } from "@/components/ui/toast";
import { peopleApi, type PersonListItem } from "@/lib/api";
import { calendarSelectionDiff, hasCalendarChanges } from "@/lib/calendar-selection";
import { monthAbbr } from "@/lib/dates";

/**
 * Catching up on a list you just joined.
 *
 * Joining used to be all-or-nothing: every birthday in the list landed in your
 * calendar whether you knew those people or not — fine for a list of six,
 * unusable for a list of a hundred. This is where you keep what matters.
 *
 * Everything starts ticked, so doing nothing leaves you exactly where joining
 * always left you — the screen only ever takes things away. It submits a diff
 * against what the server says is in your calendar, so it's equally correct when
 * reopened later from the list itself.
 */

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

interface MonthGroup {
  month: number;
  title: string;
  people: PersonListItem[];
}

/** Group by birthday month, ordered from the current month forward. */
function groupByMonth(people: PersonListItem[], currentMonth: number): MonthGroup[] {
  const byMonth = new Map<number, PersonListItem[]>();
  for (const person of people) {
    const list = byMonth.get(person.dob.month);
    if (list) list.push(person);
    else byMonth.set(person.dob.month, [person]);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => ((a - currentMonth + 12) % 12) - ((b - currentMonth + 12) % 12))
    .map(([month, group]) => ({
      month,
      title: `${MONTH_NAMES[month - 1]} · ${group.length}`,
      people: [...group].sort(
        (x, y) => x.dob.day - y.dob.day || x.fullName.localeCompare(y.fullName),
      ),
    }));
}

export function ListCatchUp({
  listId,
  listName,
  onDone,
}: {
  listId: string;
  listName: string;
  /** Called once the choice is saved, or when the user defers it. */
  onDone: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string> | null>(null);
  const [saving, setSaving] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const { data, isError } = useQuery({
    queryKey: ["people", { list: listId }],
    queryFn: () => peopleApi.list({ list: listId, sort: "name" }),
  });

  // Your own entry isn't yours to decide about — it's in the list for everyone
  // else, and it's never in your own calendar.
  const people = useMemo(
    () => (data?.people ?? []).filter((p) => !p.selfUserId || !p.isMine),
    [data],
  );

  useEffect(() => {
    if (!data) return;
    setSelected(
      (prev) => prev ?? new Set(people.filter((p) => p.inMyCalendar !== false).map((p) => p.id)),
    );
  }, [data, people]);

  const total = people.length;
  const chosen = selected?.size ?? 0;

  // "Some selected" only exists as a DOM property, never an attribute.
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = chosen > 0 && chosen < total;
    }
  }, [chosen, total]);

  const groups = useMemo(
    () => groupByMonth(people, new Date().getMonth() + 1),
    [people],
  );

  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const save = async () => {
    if (!selected) return;
    const diff = calendarSelectionDiff(people, selected);
    if (!hasCalendarChanges(diff)) return onDone();
    setSaving(true);
    try {
      await peopleApi.setCalendar(diff);
      for (const key of ["people", "person", "upcoming", "reminders", "calendar-events"]) {
        queryClient.invalidateQueries({ queryKey: [key] });
      }
      toast({
        message:
          chosen === 0
            ? `Nothing from ${listName} added.`
            : `${chosen} ${chosen === 1 ? "birthday" : "birthdays"} added to your calendar.`,
        tone: "success",
      });
      onDone();
    } catch {
      setSaving(false);
      toast({ message: "Couldn't save that. Try again.", tone: "error" });
    }
  };

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-4">
        <p className="text-sm text-ink-secondary">
          Couldn&apos;t load the list. You&apos;ve still joined it.
        </p>
        <Button onClick={onDone}>Open list</Button>
      </div>
    );
  }

  if (!selected) return <p className="text-sm text-ink-muted">Loading…</p>;

  const cta =
    chosen === 0
      ? "Don't add anyone"
      : chosen === total
        ? `Add all ${total} to my calendar`
        : `Add ${chosen} to my calendar`;

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl font-semibold text-ink">Catch up on {listName}</h1>
        <p className="mt-2 text-sm text-ink-secondary">
          {total === 1
            ? "There's 1 birthday already in this list. It's in your calendar — untick it if you'd rather skip it."
            : `There are ${total} birthdays already in this list. They're all in your calendar — untick anyone you'd rather skip.`}
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex items-center gap-2 text-sm text-ink-secondary">
          <Checkbox
            ref={selectAllRef}
            checked={chosen === total && total > 0}
            onChange={(e) =>
              setSelected(e.target.checked ? new Set(people.map((p) => p.id)) : new Set())
            }
            aria-label="Select every birthday"
          />
          Select all
        </label>
        <Chip onClick={() => setSelected(new Set())}>Select none</Chip>
        <span className="ml-auto text-xs text-ink-muted">
          {chosen} of {total} selected
        </span>
      </div>

      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <section key={group.month}>
            <h3 className="mb-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
              {group.title}
            </h3>
            <ul className="divide-y divide-border-subtle">
              {group.people.map((person) => (
                <li key={person.id}>
                  <label className="flex cursor-pointer items-center gap-3 py-2.5">
                    <Checkbox
                      checked={selected.has(person.id)}
                      onChange={() => toggle(person.id)}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm text-ink">{person.fullName}</span>
                      {person.relationshipTag ? (
                        <span className="block text-xs text-ink-muted">
                          {person.relationshipTag}
                        </span>
                      ) : null}
                    </span>
                    <span className="text-xs text-ink-secondary">
                      {monthAbbr(person.dob.month)} {person.dob.day}
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-border-subtle pt-4">
        <Button onClick={save} size="lg" disabled={saving}>
          {saving ? "Saving…" : cta}
        </Button>
        <Button variant="ghost" onClick={onDone}>
          Decide later
        </Button>
      </div>
    </div>
  );
}
