import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { cn } from '@/lib/cn';
import { useTokens } from '@/theme/theme-provider';

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
};

export function Input({ error, className, onFocus, onBlur, ...rest }: InputProps) {
  const tokens = useTokens();
  const [focused, setFocused] = useState(false);

  return (
    <TextInput
      placeholderTextColor={tokens.inkMuted}
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
}

export type TextFieldProps = Omit<InputProps, 'error'> & {
  label?: string;
  optional?: boolean;
  /** Field-level error message — turns the border danger and shows the fix. */
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
