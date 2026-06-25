import { View } from 'react-native';
import { Check } from 'lucide-react-native';

import { cn } from '@/lib/cn';
import { useTokens } from '@/theme/theme-provider';

import { Icon } from './icon';
import { Text } from './text';

/**
 * Pill / tag (DESIGN.md §8.3, §8.7). Relationship tags are `neutral` (no
 * per-tag color - color is reserved for the ring). Status pills use their own
 * state color and never appear as page accents. `done` gets a check.
 */

export type PillTone = 'neutral' | 'ok' | 'snooze' | 'warn' | 'danger' | 'info';

const TONE: Record<PillTone, { bg: string; text: string }> = {
  neutral: { bg: 'bg-surface-sunken', text: 'text-ink-secondary' },
  ok: { bg: 'bg-ok-bg', text: 'text-ok-fg' },
  snooze: { bg: 'bg-snooze-bg', text: 'text-snooze-fg' },
  warn: { bg: 'bg-warn-bg', text: 'text-warn-fg' },
  danger: { bg: 'bg-danger-bg', text: 'text-danger-fg' },
  info: { bg: 'bg-biro-tint', text: 'text-biro-pressed' },
};

export function Pill({
  label,
  tone = 'neutral',
  check = false,
}: {
  label: string;
  tone?: PillTone;
  check?: boolean;
}) {
  const tokens = useTokens();
  return (
    <View
      className={cn(
        'flex-row items-center gap-1 self-start rounded-sm px-2 py-1',
        TONE[tone].bg,
      )}>
      {check ? <Icon icon={Check} size={16} color={tokens.okFg} strokeWidth={2.5} /> : null}
      <Text variant="caption" className={TONE[tone].text}>
        {label}
      </Text>
    </View>
  );
}
