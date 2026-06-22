import { Image } from 'expo-image';
import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { CalendarPlus, ChevronLeft, Pencil, Trash2 } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { AddEventSheet } from '@/components/add-event-sheet';
import { DateRing, type RingState } from '@/components/date-ring';
import { NotesSection } from '@/components/notes-section';
import { Button, Card, Icon, Pill, Screen, Text, useConfirm, useToast } from '@/components/ui';
import {
  ApiError,
  eventsApi,
  peopleApi,
  type EventItem,
  type Person,
  type PersonWithEvents,
} from '@/lib/api';
import {
  ageTurning,
  countdownLabel,
  daysUntil,
  monthAbbr,
  nextOccurrence,
  ringStateForOccurrence,
} from '@/lib/dates';
import { useTokens } from '@/theme/theme-provider';

/**
 * Person profile (DESIGN.md §8.6) — the widget deep-link target (FR-50). Header
 * is a perfect-circle avatar + name + relationship tag + the `lg` ring for the
 * next event; below it, each event is a compact `sm`-ring row. Edit reuses the
 * add-person form; delete confirms with plain consequence copy (§10) and
 * cascades on the server (FR-8). Notes + extra events land in Stage 6.
 */

function eventLabel(event: EventItem): string {
  if (event.type === 'birthday') return 'Birthday';
  if (event.type === 'anniversary') return 'Anniversary';
  return event.customName ?? 'Event';
}

type ResolvedEvent = {
  event: EventItem;
  occurrence: Date;
  days: number;
  state: RingState;
  age: number | null;
};

/** Resolve each event's next occurrence locally (device tz == user tz). */
function resolveEvents(person: Person, events: EventItem[]): ResolvedEvent[] {
  return events
    .map((event) => {
      const occurrence = nextOccurrence(event.date.month, event.date.day, person.feb29Rule);
      return {
        event,
        occurrence,
        days: daysUntil(occurrence),
        state: ringStateForOccurrence(occurrence),
        age: event.type === 'birthday' ? ageTurning(occurrence, event.date.year) : null,
      };
    })
    .sort((a, b) => a.days - b.days);
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export default function PersonScreen() {
  const router = useRouter();
  const t = useTokens();
  const confirm = useConfirm();
  const toast = useToast();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [data, setData] = useState<PersonWithEvents | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      setData(await peopleApi.get(id));
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Couldn't load this profile. Try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [id]);

  // Refetch on focus so edits made in the add-person modal show on return.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const onDelete = async () => {
    if (!data) return;
    const ok = await confirm({
      title: `Delete ${data.person.fullName}?`,
      message: `This removes ${data.person.fullName} and all their reminders. This can't be undone.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    setDeleting(true);
    try {
      await peopleApi.remove(data.person.id);
      toast.show('Deleted.');
      router.back();
    } catch (e) {
      setDeleting(false);
      setError(e instanceof ApiError ? e.message : "Couldn't delete. Try again.");
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center gap-2 pb-2 pt-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back">
          <Icon icon={ChevronLeft} size={24} />
        </Pressable>
        <Text variant="title">Profile</Text>
      </View>

      {loading && !data ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={t.biro} />
        </View>
      ) : error && !data ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="body" className="text-center text-ink-secondary">
            {error}
          </Text>
          <Button variant="secondary" onPress={() => void load()}>
            Try again
          </Button>
        </View>
      ) : data ? (
        <ProfileBody
          data={data}
          deleting={deleting}
          onEdit={() => router.push(`/add-person?id=${data.person.id}`)}
          onDelete={onDelete}
          onReload={() => void load()}
        />
      ) : null}
    </Screen>
  );
}

function ProfileBody({
  data,
  deleting,
  onEdit,
  onDelete,
  onReload,
}: {
  data: PersonWithEvents;
  deleting: boolean;
  onEdit: () => void;
  onDelete: () => void;
  onReload: () => void;
}) {
  const t = useTokens();
  const confirm = useConfirm();
  const toast = useToast();
  const { person } = data;
  const resolved = resolveEvents(person, data.events);
  const next = resolved[0];
  // View-only members can read but not change a shared person (FR-43/45).
  const canEdit = person.access !== 'view';

  const [addOpen, setAddOpen] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);

  // Remove an anniversary/custom event (the birthday has no delete — it lives
  // with the person). Cascades its reminders server-side (FR-16, §10).
  const onRemoveEvent = async (event: EventItem) => {
    const ok = await confirm({
      title: 'Remove event?',
      message: `This removes ${eventLabel(event)} and its reminders. This can’t be undone.`,
      confirmLabel: 'Remove',
      destructive: true,
    });
    if (!ok) return;
    setRemovingId(event.id);
    try {
      await eventsApi.remove(event.id);
      onReload();
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : "Couldn't remove the event. Try again.");
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
      {/* Header (§8.6) — avatar, name + tag, and the lg ring for the next event. */}
      <View className="items-center gap-3 pb-2 pt-2">
        <Avatar person={person} />
        <View className="items-center gap-2">
          <View className="flex-row items-center gap-2">
            <Text variant="title" className="text-center">
              {person.fullName}
            </Text>
          </View>
          {person.relationshipTag || person.type === 'pet' ? (
            <View className="flex-row gap-1.5">
              {person.type === 'pet' ? <Pill label="Pet" /> : null}
              {person.relationshipTag ? <Pill label={person.relationshipTag} /> : null}
            </View>
          ) : null}
        </View>

        {next ? (
          <View className="items-center gap-2 pt-2">
            <DateRing
              day={next.occurrence.getDate()}
              month={monthAbbr(next.occurrence.getMonth() + 1)}
              size="lg"
              state={next.state}
            />
            <Text variant="body" tabularNums className="font-body-medium text-biro">
              {countdownLabel(next.days)}
            </Text>
            {next.age != null ? (
              <Text variant="caption" tabularNums>
                {eventLabel(next.event)} · turns {next.age}
              </Text>
            ) : (
              <Text variant="caption">{eventLabel(next.event)}</Text>
            )}
          </View>
        ) : null}
      </View>

      {/* Events list (§8.6) — birthday + anniversary + custom, each independent. */}
      <Text variant="label" className="mb-2 mt-6 text-ink-muted">
        Events
      </Text>
      <Card>
        {resolved.map((r, i) => (
          <View
            key={r.event.id}
            className={i > 0 ? 'mt-3 border-t border-border-subtle pt-3' : undefined}>
            <View className="flex-row items-center gap-3">
              <DateRing
                day={r.occurrence.getDate()}
                month={monthAbbr(r.occurrence.getMonth() + 1)}
                size="sm"
                state={r.state}
              />
              <View className="flex-1">
                <Text variant="cardName">{eventLabel(r.event)}</Text>
                <Text variant="caption" tabularNums className="mt-0.5">
                  {monthAbbr(r.occurrence.getMonth() + 1)} {r.occurrence.getDate()} ·{' '}
                  {countdownLabel(r.days)}
                </Text>
              </View>
              {/* The birthday can't be removed on its own (delete the person).
                  View-only members can't remove events either (FR-45). */}
              {r.event.type !== 'birthday' && canEdit ? (
                removingId === r.event.id ? (
                  <ActivityIndicator color={t.inkMuted} />
                ) : (
                  <Pressable
                    onPress={() => void onRemoveEvent(r.event)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel={`Remove ${eventLabel(r.event)}`}
                    className="active:scale-90">
                    <Icon icon={Trash2} size={18} color={t.inkMuted} />
                  </Pressable>
                )
              ) : null}
            </View>
          </View>
        ))}
      </Card>

      {/* Dashed "Add event" row (§8.6) — anniversaries / custom events.
          Hidden for view-only members (FR-45). */}
      {canEdit ? (
        <Pressable
          onPress={() => setAddOpen(true)}
          accessibilityRole="button"
          accessibilityLabel="Add event"
          className="mt-2 flex-row items-center justify-center gap-2 rounded-lg border border-dashed border-border-strong py-3 active:scale-[0.99]">
          <Icon icon={CalendarPlus} size={18} color={t.biro} />
          <Text variant="button" className="text-biro">
            Add event
          </Text>
        </Pressable>
      ) : null}

      {/* Gift notes (§8.6) — running, timestamped list. */}
      <NotesSection personId={person.id} canEdit={canEdit} />

      {/* Attribution — who last touched this entry (FR-45). */}
      {person.lastEditedBy ? (
        <Text variant="caption" className="mt-6 text-center text-ink-muted">
          Last edited by {person.lastEditedBy.name}
        </Text>
      ) : null}

      <View className="mt-3 gap-2">
        {canEdit ? (
          <>
            <Button variant="secondary" leftIcon={Pencil} fullWidth onPress={onEdit}>
              Edit
            </Button>
            <Button variant="destructive" leftIcon={Trash2} fullWidth loading={deleting} onPress={onDelete}>
              Delete
            </Button>
          </>
        ) : (
          <Text variant="caption" className="text-center text-ink-muted">
            You have view-only access to this shared person.
          </Text>
        )}
      </View>

      <AddEventSheet
        visible={addOpen}
        personId={person.id}
        onClose={() => setAddOpen(false)}
        onCreated={onReload}
      />
    </ScrollView>
  );
}

/** Perfect-circle avatar (never a ring — §1). Photo in Stage 6; initials now. */
function Avatar({ person }: { person: Person }) {
  return (
    <View className="h-[72px] w-[72px] items-center justify-center overflow-hidden rounded-full bg-surface-sunken">
      {person.photoUrl ? (
        <Image source={{ uri: person.photoUrl }} style={{ width: 72, height: 72 }} contentFit="cover" />
      ) : (
        <Text variant="ringLg" className="text-ink-secondary">
          {initials(person.fullName)}
        </Text>
      )}
    </View>
  );
}
