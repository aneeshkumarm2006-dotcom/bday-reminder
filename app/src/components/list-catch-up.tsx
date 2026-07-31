import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, SectionList, View } from 'react-native';

import { Button, Checkbox, Chip, Text, useToast } from '@/components/ui';
import { ApiError, peopleApi, type PersonListItem } from '@/lib/api';
import { calendarSelectionDiff, hasCalendarChanges } from '@/lib/calendar-selection';
import { cn, focusRing } from '@/lib/cn';
import { monthAbbr } from '@/lib/dates';

/**
 * Catching up on a list you just joined.
 *
 * Joining used to be all-or-nothing: every birthday in the list landed in your
 * calendar whether you knew those people or not, which is fine for a list of six
 * and unusable for a list of a hundred. This is where you keep what matters.
 *
 * Everything starts ticked, so doing nothing leaves you exactly where joining
 * always left you - the screen only ever takes things away. It submits a diff
 * against what the server says is currently in your calendar, so the same
 * component is correct when it's opened again later from the list itself.
 *
 * `SectionList` rather than the mapped ScrollView used elsewhere in the app: a
 * hundred interactive rows is the one place in this codebase where that matters.
 */

interface Section {
  title: string;
  month: number;
  data: PersonListItem[];
}

/** Group by birthday month, ordered from the current month forward. */
function groupByMonth(people: PersonListItem[], currentMonth: number): Section[] {
  const byMonth = new Map<number, PersonListItem[]>();
  for (const person of people) {
    const list = byMonth.get(person.dob.month);
    if (list) list.push(person);
    else byMonth.set(person.dob.month, [person]);
  }

  const MONTH_NAMES = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  return [...byMonth.entries()]
    .sort(([a], [b]) => ((a - currentMonth + 12) % 12) - ((b - currentMonth + 12) % 12))
    .map(([month, data]) => ({
      month,
      title: `${MONTH_NAMES[month - 1]} · ${data.length}`,
      data: [...data].sort((x, y) => x.dob.day - y.dob.day || x.fullName.localeCompare(y.fullName)),
    }));
}

/**
 * One row. Memoized and given only the id in its callback, so ticking a box
 * re-renders that row rather than the whole section.
 */
const Row = memo(function Row({
  person,
  checked,
  onToggle,
}: {
  person: PersonListItem;
  checked: boolean;
  onToggle: (id: string) => void;
}) {
  // Deliberately no DateRing here - it's SVG, and a hundred of them is the
  // difference between this scrolling smoothly and not.
  const date = `${monthAbbr(person.dob.month)} ${person.dob.day}`;
  return (
    <Pressable
      onPress={() => onToggle(person.id)}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={`${person.fullName}, ${date}`}
      className={cn('flex-row items-center gap-3 rounded-sm px-1 py-3 active:opacity-70', focusRing)}>
      <Checkbox checked={checked} decorative />
      <View className="flex-1">
        <Text variant="body" numberOfLines={1}>
          {person.fullName}
        </Text>
        {person.relationshipTag ? (
          <Text variant="caption" className="text-ink-muted">
            {person.relationshipTag}
          </Text>
        ) : null}
      </View>
      <Text variant="caption" className="text-ink-secondary">
        {date}
      </Text>
    </Pressable>
  );
});

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
  const toast = useToast();
  const [people, setPeople] = useState<PersonListItem[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await peopleApi.list({ list: listId, sort: 'name' });
        if (!active) return;
        // Your own entry isn't yours to decide about - it's in the list for
        // everyone else, and it's never in your own calendar.
        const others = res.people.filter((p) => !p.selfUserId || !p.isMine);
        setPeople(others);
        setSelected(new Set(others.filter((p) => p.inMyCalendar !== false).map((p) => p.id)));
      } catch (e) {
        if (active) {
          setError(
            e instanceof ApiError ? e.message : "Couldn't load the list. You've still joined it.",
          );
        }
      }
    })();
    return () => {
      active = false;
    };
  }, [listId]);

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const currentMonth = new Date().getMonth() + 1;
  const sections = useMemo(
    () => (people ? groupByMonth(people, currentMonth) : []),
    [people, currentMonth],
  );

  const total = people?.length ?? 0;
  const chosen = selected.size;

  const save = async () => {
    if (!people) return;
    const diff = calendarSelectionDiff(people, selected);
    if (!hasCalendarChanges(diff)) return onDone();
    setSaving(true);
    try {
      await peopleApi.setCalendar(diff);
      toast.show(
        chosen === 0
          ? `Nothing from ${listName} added.`
          : `${chosen} ${chosen === 1 ? 'birthday' : 'birthdays'} added to your calendar.`,
      );
      onDone();
    } catch {
      setSaving(false);
      toast.show("Couldn't save that. Check your connection and try again.");
    }
  };

  if (error) {
    return (
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <Text variant="body" className="text-center text-ink-secondary">
          {error}
        </Text>
        <Button variant="secondary" onPress={onDone}>
          Open list
        </Button>
      </View>
    );
  }

  if (!people) {
    return (
      <View className="flex-1 items-center justify-center">
        <ActivityIndicator />
      </View>
    );
  }

  const cta =
    chosen === 0
      ? "Don't add anyone"
      : chosen === total
        ? `Add all ${total} to my calendar`
        : `Add ${chosen} to my calendar`;

  return (
    <View className="flex-1">
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled
        initialNumToRender={12}
        windowSize={7}
        removeClippedSubviews
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 16 }}
        ListHeaderComponent={
          <View className="gap-3 pb-2 pt-4">
            <Text variant="title">Catch up on {listName}</Text>
            <Text variant="body" className="text-ink-secondary">
              {total === 1
                ? "There's 1 birthday already in this list. It's in your calendar — untick it if you'd rather skip it."
                : `There are ${total} birthdays already in this list. They're all in your calendar — untick anyone you'd rather skip.`}
            </Text>
            <View className="flex-row items-center gap-2">
              <Chip
                label="Select all"
                onPress={() => setSelected(new Set(people.map((p) => p.id)))}
              />
              <Chip label="Select none" onPress={() => setSelected(new Set())} />
              <Text variant="caption" className="ml-auto text-ink-muted">
                {chosen} of {total} selected
              </Text>
            </View>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View className="bg-paper py-2">
            <Text variant="label" className="text-ink-muted">
              {(section as Section).title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => (
          <Row person={item} checked={selected.has(item.id)} onToggle={toggle} />
        )}
      />

      <View className="gap-2 border-t border-border-subtle px-5 pb-2 pt-3">
        <Button fullWidth loading={saving} onPress={save}>
          {cta}
        </Button>
        <Button variant="ghost" fullWidth onPress={onDone}>
          Decide later
        </Button>
      </View>
    </View>
  );
}
