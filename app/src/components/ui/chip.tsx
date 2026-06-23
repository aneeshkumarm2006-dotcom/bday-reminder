import { Pressable } from 'react-native';

import { cn, focusRing } from '@/lib/cn';

import { Text } from './text';

/**
 * Multi-select chip (DESIGN.md §8.4) — used for lead-time and relationship
 * filters. Selected: biro-tint bg, biro-pressed text, biro border. Unselected:
 * surface-sunken bg, ink-secondary text. Multiple can be active at once.
 */

export type ChipProps = {
  label: string;
  selected?: boolean;
  onPress?: () => void;
};

export function Chip({ label, selected = false, onPress }: ChipProps) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={6}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      className={cn(
        'min-h-[40px] flex-row items-center justify-center rounded-sm border px-3 active:scale-[0.98]',
        focusRing,
        selected ? 'border-biro bg-biro-tint' : 'border-transparent bg-surface-sunken',
      )}>
      <Text variant="label" className={selected ? 'text-biro-pressed' : 'text-ink-secondary'}>
        {label}
      </Text>
    </Pressable>
  );
}
