import type { LucideIcon } from 'lucide-react-native';

import { useTokens } from '@/theme/theme-provider';

/**
 * Icon wrapper (DESIGN.md §6). Lucide, outline only, stroke 1.75, sizes
 * 16 / 20 / 24. Icons inherit ink by default; pass `label` for meaningful icons
 * (sets an accessibility label) or leave it off for decorative ones (hidden
 * from screen readers).
 */

export type IconProps = {
  icon: LucideIcon;
  size?: 16 | 20 | 24 | number;
  /** Defaults to current ink. Pass a token hex for state colors. */
  color?: string;
  strokeWidth?: number;
  fill?: string;
  /** Accessibility label; omit for decorative icons. */
  label?: string;
};

export function Icon({ icon: IconComponent, size = 20, color, strokeWidth = 1.75, fill, label }: IconProps) {
  const tokens = useTokens();
  return (
    <IconComponent
      size={size}
      color={color ?? tokens.ink}
      strokeWidth={strokeWidth}
      fill={fill}
      accessibilityLabel={label}
      aria-hidden={label ? undefined : true}
    />
  );
}
