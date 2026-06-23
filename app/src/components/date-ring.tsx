import { Check } from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, Text as RNText, View } from 'react-native';
import Animated, {
  Easing,
  interpolateColor,
  useAnimatedProps,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';

import { useTokens } from '@/theme/theme-provider';
import { fontFamily } from '@/theme/tokens';

import { Icon } from './ui/icon';

/**
 * ⭐ The ring — the one signature element (DESIGN.md §7). A hand-drawn circle
 * (one wobbly SVG path, tilted -4°, number upright) around an event's day
 * number with a month caption below.
 *
 * States: upcoming (biro outline) · today (biro outline + fill, paper number) ·
 * done (muted outline + check) · past (strong-border outline). On a `today`
 * card mount the ring draws on, fills, and the number cross-fades to paper —
 * the only orchestrated motion in the app. `prefers-reduced-motion` renders the
 * filled state instantly (§7.6, §9).
 */

const RING_PATH = 'M33 8 C49 7 58 19 57 32 C56 47 41 57 26 55 C12 53 6 39 9 25 C12 13 22 8 36 9';
// Approximate length of the path above — used as the stroke-dasharray for the
// draw-on. Slightly longer than the true length so the line fully hides/reveals.
const PATH_LENGTH = 160;

const BOX = { sm: 40, md: 56, lg: 72 } as const;
const STROKE = { sm: 2, md: 2.4, lg: 3 } as const;
const NUM = { sm: 16, md: 20, lg: 26 } as const;

export type RingState = 'upcoming' | 'today' | 'done' | 'past';
export type RingSize = keyof typeof BOX;

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedText = Animated.createAnimatedComponent(RNText);

const STATE_WORD: Record<RingState, string> = {
  upcoming: '',
  today: ', today',
  done: ', done',
  past: ', past',
};

export function DateRing({
  day,
  month,
  size = 'md',
  state = 'upcoming',
  accessibilityLabel,
}: {
  day: number;
  month: string;
  size?: RingSize;
  state?: RingState;
  accessibilityLabel?: string;
}) {
  const t = useTokens();
  const reducedMotion = useReducedMotion();

  const box = BOX[size];
  const stroke = STROKE[size];
  const num = NUM[size];
  const filled = state === 'today';
  const animate = filled && !reducedMotion;

  // 1 = fully hidden outline, 0 = fully drawn.
  const draw = useSharedValue(animate ? 1 : 0);
  // Fill + number-color cross-fade (0 -> 1). For a static filled ring start at 1.
  const fillOpacity = useSharedValue(filled && !animate ? 1 : 0);
  const numberCrossfade = useSharedValue(filled && !animate ? 1 : 0);

  useEffect(() => {
    if (!animate) return;
    draw.value = withTiming(0, { duration: 600, easing: Easing.out(Easing.ease) });
    fillOpacity.value = withDelay(600, withTiming(1, { duration: 250 }));
    numberCrossfade.value = withDelay(650, withTiming(1, { duration: 250 }));
  }, [animate, draw, fillOpacity, numberCrossfade]);

  const outlineColor =
    state === 'done' ? t.inkMuted : state === 'past' ? t.borderStrong : t.biro;

  const outlineProps = useAnimatedProps(() => ({
    strokeDashoffset: draw.value * PATH_LENGTH,
  }));
  const fillProps = useAnimatedProps(() => ({ fillOpacity: fillOpacity.value }));
  const animatedNumberStyle = useAnimatedStyle(() => ({
    color: interpolateColor(numberCrossfade.value, [0, 1], [t.ink, t.paper]),
  }));

  const staticNumberColor = filled ? t.paper : state === 'upcoming' ? t.ink : t.inkMuted;
  // Month caption: paper @ 75% on the filled ring, otherwise muted ink.
  const monthColor = filled ? `${t.paper}BF` : t.inkMuted;

  const label = accessibilityLabel ?? `${day} ${month}${STATE_WORD[state]}`;

  return (
    <View
      style={{ width: box, height: box }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={label}>
      <View style={[StyleSheet.absoluteFill, { transform: [{ rotate: '-4deg' }] }]}>
        <Svg width={box} height={box} viewBox="0 0 64 64">
          {filled ? (
            <AnimatedPath testID="date-ring-fill" d={RING_PATH} fill={t.biro} animatedProps={fillProps} />
          ) : null}
          <AnimatedPath
            d={RING_PATH}
            fill="none"
            stroke={outlineColor}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={animate ? PATH_LENGTH : undefined}
            animatedProps={outlineProps}
          />
        </Svg>
      </View>

      <View style={[StyleSheet.absoluteFill, styles.center]} pointerEvents="none">
        {filled ? (
          <AnimatedText
            style={[
              { fontFamily: fontFamily.display, fontSize: num, lineHeight: num },
              styles.tabular,
              animate ? animatedNumberStyle : { color: staticNumberColor },
            ]}>
            {day}
          </AnimatedText>
        ) : (
          <RNText
            style={[
              { fontFamily: fontFamily.display, fontSize: num, lineHeight: num, color: staticNumberColor },
              styles.tabular,
            ]}>
            {day}
          </RNText>
        )}
        <RNText
          style={{
            fontFamily: fontFamily.body,
            fontSize: 10,
            lineHeight: 13,
            letterSpacing: 0.4,
            color: monthColor,
          }}>
          {month}
        </RNText>
      </View>

      {state === 'done' ? (
        <View style={styles.check} className="bg-ok-bg">
          <Icon icon={Check} size={11} color={t.okFg} strokeWidth={3.5} label="Done" />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', gap: 1 },
  tabular: { fontVariant: ['tabular-nums'] },
  check: {
    position: 'absolute',
    right: -2,
    bottom: -1,
    width: 17,
    height: 17,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
