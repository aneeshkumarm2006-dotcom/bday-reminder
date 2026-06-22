import { useFocusEffect, useRouter } from 'expo-router';
import { Cake, Plus, Upload } from 'lucide-react-native';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { PersonCard } from '@/components/person-card';
import { Button, Chip, EmptyState, Icon, Screen, Text } from '@/components/ui';
import { ApiError, peopleApi, type UpcomingGroup, type UpcomingResponse } from '@/lib/api';
import { syncWidget } from '@/lib/widget';
import { useTokens } from '@/theme/theme-provider';

/**
 * Upcoming feed (DESIGN.md §8.2). The computed feed comes from `GET /upcoming`
 * — each person's next event, grouped This week / This month / Later and sorted
 * ascending. A relationship-tag chip row filters the list (FR-9); the feed
 * mounts with a subtle stagger fade+rise (§9), reduced-motion safe.
 */

const GROUP_ORDER: UpcomingGroup[] = ['This week', 'This month', 'Later'];

export default function UpcomingScreen() {
  const router = useRouter();
  const t = useTokens();
  const reducedMotion = useReducedMotion();

  const [data, setData] = useState<UpcomingResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const next = await peopleApi.upcoming();
      setData(next);
      // Refresh the on-device home-screen widget cache (Stage 10; FR-48).
      // Native-only + best-effort; a no-op on web.
      void syncWidget(next.items);
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Couldn't load your birthdays. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch on focus so a just-added person shows immediately (§9.1).
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  if (loading && !data) {
    return (
      <Screen>
        <FeedHeader onAdd={() => router.push('/add-person')} />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={t.biro} />
        </View>
      </Screen>
    );
  }

  if (error && !data) {
    return (
      <Screen>
        <FeedHeader onAdd={() => router.push('/add-person')} />
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="body" className="text-center text-ink-secondary">
            {error}
          </Text>
          <Button variant="secondary" onPress={() => void load()}>
            Try again
          </Button>
        </View>
      </Screen>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <Screen>
        <FeedHeader onAdd={() => router.push('/add-person')} />
        <EmptyState
          icon={Cake}
          title="No birthdays yet."
          body="Add the people you don't want to forget.">
          <Button leftIcon={Plus} fullWidth onPress={() => router.push('/add-person')}>
            Add person
          </Button>
          <Button
            variant="secondary"
            leftIcon={Upload}
            fullWidth
            onPress={() => router.push('/import')}>
            Import people
          </Button>
        </EmptyState>
      </Screen>
    );
  }

  const tags = data?.tags ?? [];
  // Fall back to "All" if the active tag no longer exists (e.g. its last person
  // was deleted) — otherwise the chip row vanishes and strands the filter.
  const effectiveTag = activeTag && tags.includes(activeTag) ? activeTag : null;
  const visible = effectiveTag
    ? items.filter((i) => i.relationshipTag === effectiveTag)
    : items;

  // Build header/card rows in group order; remember header positions so the
  // section headings stick on scroll. A running index drives the stagger.
  const rows: ReactNode[] = [];
  const stickyIndices: number[] = [];
  let animIndex = 0;
  for (const group of GROUP_ORDER) {
    const groupItems = visible.filter((i) => i.group === group);
    if (groupItems.length === 0) continue;
    stickyIndices.push(rows.length);
    rows.push(<SectionHeader key={`h-${group}`} label={group} />);
    for (const item of groupItems) {
      rows.push(
        <FeedItem key={item.eventId} index={animIndex} reduced={reducedMotion}>
          <PersonCard item={item} onPress={() => router.push(`/person/${item.personId}`)} />
        </FeedItem>,
      );
      animIndex += 1;
    }
  }

  return (
    <Screen>
      <FeedHeader onAdd={() => router.push('/add-person')} />

      {tags.length > 0 ? (
        <View className="pb-1">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: 8, paddingVertical: 4 }}>
            <Chip label="All" selected={effectiveTag === null} onPress={() => setActiveTag(null)} />
            {tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                selected={effectiveTag === tag}
                onPress={() => setActiveTag(tag)}
              />
            ))}
          </ScrollView>
        </View>
      ) : null}

      {visible.length === 0 ? (
        <View className="flex-1 items-center justify-center px-6">
          <Text variant="body" className="text-center text-ink-secondary">
            No birthdays tagged “{effectiveTag}” yet.
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          stickyHeaderIndices={stickyIndices}
          contentContainerStyle={{ paddingBottom: 24 }}>
          {rows}
        </ScrollView>
      )}
    </Screen>
  );
}

function FeedHeader({ onAdd }: { onAdd: () => void }) {
  return (
    <View className="flex-row items-center justify-between pb-2 pt-3">
      <Text variant="title">Upcoming</Text>
      <Pressable
        onPress={onAdd}
        hitSlop={10}
        accessibilityRole="button"
        accessibilityLabel="Add person"
        className="h-9 w-9 items-center justify-center rounded-full active:scale-95">
        <Icon icon={Plus} size={24} />
      </Pressable>
    </View>
  );
}

/** Sticky group heading on a sunken band (DESIGN.md §8.2, §4.1: Hanken 600 18px). */
function SectionHeader({ label }: { label: string }) {
  return (
    <View className="bg-paper">
      <View className="mb-2 mt-3 rounded-sm bg-surface-sunken px-3 py-2">
        <Text variant="heading">{label}</Text>
      </View>
    </View>
  );
}

/** One feed row with a subtle mount fade+rise, staggered by index (§9). */
function FeedItem({
  index,
  reduced,
  children,
}: {
  index: number;
  reduced: boolean;
  children: ReactNode;
}) {
  // Held in state (not a ref) so it's safe to read in render — matches Toast.
  const [progress] = useState(() => new Animated.Value(reduced ? 1 : 0));

  useEffect(() => {
    if (reduced) return;
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 240,
      delay: Math.min(index, 12) * 30,
      useNativeDriver: true,
    });
    animation.start();
    return () => animation.stop();
  }, [index, reduced, progress]);

  return (
    <Animated.View
      style={{
        marginBottom: 8,
        opacity: progress,
        transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
      }}>
      {children}
    </Animated.View>
  );
}
