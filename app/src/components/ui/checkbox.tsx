import { Check } from 'lucide-react-native';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { cn, focusRing } from '@/lib/cn';
import { useTokens } from '@/theme/theme-provider';

/**
 * A checkbox, for picking several things out of a long list (DESIGN.md §6).
 *
 * The kit expressed multi-select with `Chip` until now, which works for a handful
 * of filters but announces as a button and doesn't scale to a hundred rows. This
 * announces as a checkbox and is small enough to sit at the head of a row.
 *
 * Usually the whole row is the pressable and the box is decorative - pass
 * `decorative` then, so the row is announced once rather than twice.
 */

export type CheckboxProps = {
  checked: boolean;
  onChange?: (next: boolean) => void;
  disabled?: boolean;
  /** Rendered inside a pressable row: no touch target, no separate a11y node. */
  decorative?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Checkbox({
  checked,
  onChange,
  disabled = false,
  decorative = false,
  accessibilityLabel,
  style,
}: CheckboxProps) {
  const t = useTokens();

  const box = (
    <View
      style={style}
      className={cn(
        'h-[22px] w-[22px] items-center justify-center rounded-full border',
        checked ? 'border-biro bg-biro' : 'border-border-strong bg-transparent',
        disabled && 'opacity-40',
      )}>
      {checked ? <Check color={t.paper} size={14} strokeWidth={3} /> : null}
    </View>
  );

  if (decorative) return box;

  return (
    <Pressable
      onPress={disabled ? undefined : () => onChange?.(!checked)}
      disabled={disabled}
      hitSlop={10}
      accessibilityRole="checkbox"
      accessibilityState={{ checked, disabled }}
      accessibilityLabel={accessibilityLabel}
      className={cn('rounded-full active:scale-[0.95]', focusRing)}>
      {box}
    </Pressable>
  );
}
