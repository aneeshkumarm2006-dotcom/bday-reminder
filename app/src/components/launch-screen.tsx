import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { DateRing } from '@/components/date-ring';
import { Text } from '@/components/ui';
import { monthAbbr } from '@/lib/dates';
import { useTokens } from '@/theme/theme-provider';

/**
 * The launch screen: the app circling *today's* date, then getting out of the way.
 *
 * The native splash cannot animate (an iOS storyboard is a static image), so it
 * only has to bridge the cold-start gap with the same mark on the same paper.
 * This takes over the instant React can paint - `onPainted` is the cue to drop
 * the native one underneath - plays the ⭐ ring's draw-on against the real date,
 * and fades out. The seam between the two never shows.
 *
 * It leaves on its own terms: the ring gets its full runway AND the session has
 * to have resolved, whichever is later. That second condition is what keeps the
 * login screen from flashing past on the way to the app on a slow network. It is
 * mounted once and never re-shown, so the animation can't stutter or replay.
 *
 * Under `prefers-reduced-motion` the ring renders already-filled and the runway
 * collapses to a beat - seen, not endured (DESIGN.md §7.6, §9).
 */

/** The ring's own draw-on + fill + number cross-fade, from date-ring.tsx. */
const RING_MS = 1100;
const HOLD_MS = 260;
const FADE_MS = 320;
const REDUCED_MS = 400;

export function LaunchScreen({
  ready,
  onPainted,
  onFinished,
}: {
  /** Session resolved. The screen will not leave before this is true. */
  ready: boolean;
  /** First paint - the cue to dismiss the native splash behind this. */
  onPainted?: () => void;
  /** Animation done and faded out; the parent unmounts this. */
  onFinished: () => void;
}) {
  const t = useTokens();
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(1);
  const [runwayDone, setRunwayDone] = useState(false);

  const now = new Date();
  const day = now.getDate();
  const month = monthAbbr(now.getMonth() + 1);

  // Give the ring its runway. Separate from the exit below so a session that
  // resolves mid-animation doesn't cut the mark off half-drawn.
  useEffect(() => {
    const runway = reducedMotion ? REDUCED_MS : RING_MS + HOLD_MS;
    const timer = setTimeout(() => setRunwayDone(true), runway);
    return () => clearTimeout(timer);
  }, [reducedMotion]);

  useEffect(() => {
    if (!runwayDone || !ready) return;
    opacity.value = withTiming(
      0,
      { duration: FADE_MS, easing: Easing.out(Easing.ease) },
      (done) => {
        if (done) runOnJS(onFinished)();
      },
    );
  }, [runwayDone, ready, opacity, onFinished]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { backgroundColor: t.paper }, style]}
      onLayout={onPainted}
      // Announced once, as a whole. The ring's own label is suppressed below so
      // a screen reader doesn't read the date twice on every launch.
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel="Circle the date, loading"
      // Decorative once announced - never a tap target, and never blocking the
      // app underneath if a fade were ever interrupted.
      pointerEvents="none">
      <DateRing day={day} month={month} size="xl" state="today" accessibilityLabel=" " />
      <View style={styles.caption}>
        <Text variant="body" className="text-ink-muted">
          Circle the date
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { alignItems: 'center', justifyContent: 'center' },
  caption: { marginTop: 28 },
});
