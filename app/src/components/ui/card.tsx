import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { cn, focusRing } from '@/lib/cn';

/**
 * Surface card (DESIGN.md §5, §8.1). Flat — a hairline border defines it, never
 * a shadow. Tappable cards scale slightly on press (§9), announce as a button,
 * and show the shared focus ring for keyboard users (§11).
 */
export function Card({
  children,
  onPress,
  accessibilityLabel,
  className,
}: {
  children: ReactNode;
  onPress?: () => void;
  /** Spoken name when the whole card is the tap target. */
  accessibilityLabel?: string;
  className?: string;
}) {
  const base = 'rounded-lg border border-border-subtle bg-surface p-4';
  if (onPress) {
    return (
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        className={cn(base, 'active:scale-[0.985]', focusRing, className)}>
        {children}
      </Pressable>
    );
  }
  return <View className={cn(base, className)}>{children}</View>;
}
