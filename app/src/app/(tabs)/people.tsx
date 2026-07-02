import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { PawPrint, Plus, Users } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { initials } from '@/components/member-avatars';
import { Button, Card, Chip, EmptyState, Icon, Screen, Text, useToast } from '@/components/ui';
import { ApiError, peopleApi, type PersonListItem } from '@/lib/api';
import { cn, focusRing } from '@/lib/cn';
import { countdownLabel } from '@/lib/dates';
import { useTokens } from '@/theme/theme-provider';

/**
 * People directory - browse everyone you track, sorted by next date or by name
 * (mirrors the website's /people page). Each row: photo-or-initials avatar,
 * paw-print for pets, relationship tag, and a countdown to the next occurrence.
 * Tapping opens the profile; "+" in the header adds a person.
 */

type Sort = 'next' | 'name';

export default function PeopleScreen() {
  const router = useRouter();
  const toast = useToast();
  const t = useTokens();

  const [sort, setSort] = useState<Sort>('next');
  const [people, setPeople] = useState<PersonListItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Mirror of `people` so the load callback can tell a first-load failure (show
  // the full-screen error) from a refocus failure with data already on screen.
  const peopleRef = useRef<PersonListItem[] | null>(null);
  useEffect(() => {
    peopleRef.current = people;
  }, [people]);

  // Monotonic ticket so overlapping fetches (rapid sort taps, slow refocus)
  // can't land out of order - only the newest request may write state.
  const loadSeq = useRef(0);
  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    setError(null);
    try {
      const { people: fetched } = await peopleApi.list({ sort });
      if (loadSeq.current === seq) setPeople(fetched);
    } catch (e) {
      if (loadSeq.current !== seq) return;
      const msg = e instanceof ApiError ? e.message : "Couldn't load your people. Try again.";
      // Any prior successful load (incl. an empty list) keeps its view + a toast;
      // only a true first-load failure (still null) shows the full-screen error.
      if (peopleRef.current !== null) toast.show(msg);
      else setError(msg);
    }
  }, [sort, toast]);

  // Refetch on focus (people added elsewhere show up) and whenever sort changes.
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen>
      <View className="flex-row items-center justify-between pb-2 pt-3">
        <Text variant="title">People</Text>
        <Pressable
          onPress={() => router.push('/add-person')}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Add person"
          className={cn(
            'h-9 w-9 items-center justify-center rounded-full active:scale-95',
            focusRing,
          )}>
          <Icon icon={Plus} size={24} />
        </Pressable>
      </View>

      <View className="flex-row gap-2 pb-1 pt-1">
        <Chip label="By next date" selected={sort === 'next'} onPress={() => setSort('next')} />
        <Chip label="By name" selected={sort === 'name'} onPress={() => setSort('name')} />
      </View>

      {people === null && !error ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={t.biro} />
        </View>
      ) : error && !people ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="body" className="text-center text-ink-secondary">
            {error}
          </Text>
          <Button variant="secondary" onPress={() => void load()}>
            Try again
          </Button>
        </View>
      ) : people && people.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No people yet."
          body="Add someone to start tracking their birthday and events.">
          <Button leftIcon={Plus} fullWidth onPress={() => router.push('/add-person')}>
            Add your first person
          </Button>
        </EmptyState>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: 24, paddingTop: 8 }}>
          <View className="gap-2">
            {people?.map((person) => (
              <PersonRow
                key={person.id}
                person={person}
                onPress={() => router.push(`/person/${person.id}`)}
              />
            ))}
          </View>
        </ScrollView>
      )}
    </Screen>
  );
}

function PersonRow({ person, onPress }: { person: PersonListItem; onPress: () => void }) {
  const t = useTokens();

  const subtitle = [person.relationshipTag ?? undefined, person.type === 'pet' ? 'Pet' : undefined]
    .filter(Boolean)
    .join(' · ');

  return (
    <Card onPress={onPress} accessibilityLabel={person.fullName}>
      <View className="flex-row items-center gap-3">
        <RowAvatar person={person} />

        <View className="flex-1">
          <View className="flex-row items-center gap-1.5">
            {person.type === 'pet' ? (
              <Icon icon={PawPrint} size={16} color={t.inkMuted} label="Pet" />
            ) : null}
            <Text variant="cardName" numberOfLines={1} className="flex-shrink">
              {person.fullName}
            </Text>
          </View>
          {subtitle ? (
            <Text variant="caption" numberOfLines={1} className="mt-0.5">
              {subtitle}
            </Text>
          ) : null}
        </View>

        {person.next ? (
          <Text variant="caption" tabularNums className="pl-2 font-body-medium text-biro">
            {countdownLabel(person.next.daysRemaining)}
          </Text>
        ) : null}
      </View>
    </Card>
  );
}

/** Perfect-circle avatar (never a ring - §1): photo when set, else initials. */
function RowAvatar({ person }: { person: PersonListItem }) {
  return (
    <View className="h-11 w-11 items-center justify-center overflow-hidden rounded-full bg-surface-sunken">
      {person.photoUrl ? (
        <Image
          source={{ uri: person.photoUrl }}
          style={{ width: 44, height: 44 }}
          contentFit="cover"
          accessibilityLabel={`Photo of ${person.fullName}`}
        />
      ) : (
        <Text variant="cardName" className="text-ink-secondary">
          {initials(person.fullName)}
        </Text>
      )}
    </View>
  );
}
