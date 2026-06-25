import { useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { DateRing, type RingState } from '@/components/date-ring';
import { Button, Card, Icon, Screen, Text } from '@/components/ui';
import { cn, focusRing } from '@/lib/cn';

/**
 * Design preview - exercises the ⭐ ring in every state and size and replays the
 * day-of draw-on animation (DESIGN.md §7). A QA/reference surface for Stage 2;
 * the ring is used for real on cards in Stage 3.
 */

const STATES: { state: RingState; label: string }[] = [
  { state: 'upcoming', label: 'Upcoming' },
  { state: 'today', label: 'Today (animated)' },
  { state: 'done', label: 'Done' },
  { state: 'past', label: 'Past' },
];

export default function RingPreviewScreen() {
  const router = useRouter();
  // Bumping the key remounts the rings, replaying the day-of animation.
  const [replayKey, setReplayKey] = useState(0);

  return (
    <Screen edges={['top', 'bottom']}>
      <View className="flex-row items-center gap-2 pb-2 pt-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className={cn('rounded-full', focusRing)}>
          <Icon icon={ChevronLeft} size={24} />
        </Pressable>
        <Text variant="title">Ring preview</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24, gap: 12 }}>
        {STATES.map(({ state, label }) => (
          <Card key={`${state}-${replayKey}`}>
            <Text variant="label" className="mb-3">
              {label}
            </Text>
            <View className="flex-row items-end gap-6">
              <View className="items-center gap-1">
                <DateRing day={12} month="Jun" size="sm" state={state} />
                <Text variant="caption">sm</Text>
              </View>
              <View className="items-center gap-1">
                <DateRing day={12} month="Jun" size="md" state={state} />
                <Text variant="caption">md</Text>
              </View>
              <View className="items-center gap-1">
                <DateRing day={12} month="Jun" size="lg" state={state} />
                <Text variant="caption">lg</Text>
              </View>
            </View>
          </Card>
        ))}

        <Button variant="secondary" fullWidth onPress={() => setReplayKey((k) => k + 1)}>
          Replay day-of animation
        </Button>
      </ScrollView>
    </Screen>
  );
}
