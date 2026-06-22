import { ActivityIndicator, Pressable, View, type PressableProps } from 'react-native';

import { cn } from '@/lib/cn';
import { useTokens } from '@/theme/theme-provider';

import { Icon, type IconProps } from './icon';
import { Text } from './text';

/**
 * Buttons (DESIGN.md §8.14). 44px min target, active scale 0.98, visible focus
 * ring on web. Variants:
 *  - primary: biro fill, paper text
 *  - secondary: surface fill, strong border, ink text
 *  - ghost: transparent, ink-secondary text
 *  - destructive: danger text on transparent (filled danger lives in confirms)
 */

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'destructive';

const CONTAINER: Record<ButtonVariant, string> = {
  primary: 'bg-biro hover:bg-biro-hover border border-biro',
  secondary: 'bg-surface border border-border-strong hover:bg-surface-sunken',
  ghost: 'bg-transparent border border-transparent hover:bg-surface-sunken',
  destructive: 'bg-transparent border border-transparent hover:bg-danger-bg',
};

const LABEL_COLOR: Record<ButtonVariant, string> = {
  primary: 'text-paper',
  secondary: 'text-ink',
  ghost: 'text-ink-secondary',
  destructive: 'text-danger-fg',
};

export type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  children: string;
  variant?: ButtonVariant;
  loading?: boolean;
  /** Optional leading icon. */
  leftIcon?: IconProps['icon'];
  /** Stretch to fill the parent width. */
  fullWidth?: boolean;
  className?: string;
};

export function Button({
  children,
  variant = 'primary',
  loading = false,
  leftIcon,
  fullWidth = false,
  disabled,
  className,
  ...rest
}: ButtonProps) {
  const tokens = useTokens();
  const isDisabled = disabled || loading;

  const spinnerColor = variant === 'primary' ? tokens.paper : tokens.ink;
  const iconColor =
    variant === 'primary'
      ? tokens.paper
      : variant === 'destructive'
        ? tokens.dangerFg
        : variant === 'ghost'
          ? tokens.inkSecondary
          : tokens.ink;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      className={cn(
        'min-h-[44px] flex-row items-center justify-center gap-2 rounded-md px-4',
        'active:scale-[0.98]',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-biro',
        CONTAINER[variant],
        fullWidth && 'w-full self-stretch',
        isDisabled && 'opacity-50',
        className,
      )}
      {...rest}>
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <View className="flex-row items-center gap-2">
          {leftIcon ? <Icon icon={leftIcon} size={20} color={iconColor} /> : null}
          <Text variant="button" className={LABEL_COLOR[variant]}>
            {children}
          </Text>
        </View>
      )}
    </Pressable>
  );
}
