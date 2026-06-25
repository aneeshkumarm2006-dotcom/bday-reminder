import { Eye, EyeOff } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, TextInput, View, type TextInputProps } from 'react-native';

import { cn, focusRing } from '@/lib/cn';
import { useTokens } from '@/theme/theme-provider';

import { Icon } from './icon';
import { Text } from './text';

/**
 * Inputs & labels (DESIGN.md §8.8). Surface bg, strong border, radius-md,
 * 44px min height, biro focus ring. Errors say the fix (§10 voice) and turn the
 * border danger. "Optional" fields are marked visibly (e.g. birth year).
 */

export function Label({ children, optional }: { children: string; optional?: boolean }) {
  return (
    <View className="mb-2 flex-row items-center gap-1.5">
      <Text variant="label">{children}</Text>
      {optional ? (
        <Text variant="caption" className="text-ink-muted">
          · optional
        </Text>
      ) : null}
    </View>
  );
}

export type InputProps = TextInputProps & {
  error?: boolean;
  className?: string;
  /**
   * Render an eye button inside the field that toggles password visibility.
   * Implies a secure field - the input manages its own masked/revealed state,
   * so pass this instead of `secureTextEntry`.
   */
  secureToggle?: boolean;
};

export function Input({
  error,
  className,
  onFocus,
  onBlur,
  secureToggle,
  secureTextEntry,
  ...rest
}: InputProps) {
  const tokens = useTokens();
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);

  const field = (
    <TextInput
      placeholderTextColor={tokens.inkMuted}
      secureTextEntry={secureToggle ? !revealed : secureTextEntry}
      onFocus={(e) => {
        setFocused(true);
        onFocus?.(e);
      }}
      onBlur={(e) => {
        setFocused(false);
        onBlur?.(e);
      }}
      className={cn(
        'min-h-[44px] rounded-md border bg-surface px-3 py-2.5 font-body text-[15px] text-ink',
        // Leave room for the eye button so long passwords don't slide under it.
        secureToggle && 'pr-12',
        'web:outline-none',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-biro',
        error
          ? 'border-danger-fg'
          : focused
            ? 'border-biro'
            : 'border-border-strong',
        className,
      )}
      {...rest}
    />
  );

  if (!secureToggle) return field;

  return (
    <View className="relative justify-center">
      {field}
      <Pressable
        onPress={() => setRevealed((v) => !v)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityState={{ selected: revealed }}
        accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
        className={cn(
          'absolute bottom-0 right-1 top-0 w-10 items-center justify-center rounded-md',
          focusRing,
        )}>
        <Icon icon={revealed ? EyeOff : Eye} size={20} color={tokens.inkMuted} />
      </Pressable>
    </View>
  );
}

export type TextFieldProps = Omit<InputProps, 'error'> & {
  label?: string;
  optional?: boolean;
  /** Field-level error message - turns the border danger and shows the fix. */
  error?: string;
  hint?: string;
};

export function TextField({ label, optional, error, hint, ...inputProps }: TextFieldProps) {
  return (
    <View>
      {label ? <Label optional={optional}>{label}</Label> : null}
      <Input error={!!error} {...inputProps} />
      {error ? (
        <Text variant="caption" className="mt-1.5 text-danger-fg">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="caption" className="mt-1.5 text-ink-muted">
          {hint}
        </Text>
      ) : null}
    </View>
  );
}
