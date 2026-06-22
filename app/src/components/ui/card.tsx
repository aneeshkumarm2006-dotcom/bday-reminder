import type { ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { cn } from '@/lib/cn';

/**
 * Surface card (DESIGN.md §5, §8.1). Flat — a hairline border defines it, never
 * a shadow. Tappable cards scale slightly on press (§9).
 */
export function Card({
  children,
  onPress,
  className,
}: {
  children: ReactNode;
  onPress?: () => void;
  className?: string;
}) {
  const base = 'rounded-lg border border-border-subtle bg-surface p-4';
  if (onPress) {
    return (
      <Pressable onPress={onPress} className={cn(base, 'active:scale-[0.985]', className)}>
        {children}
      </Pressable>
    );
  }
  return <View className={cn(base, className)}>{children}</View>;
}
