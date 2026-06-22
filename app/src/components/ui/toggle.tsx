import { Switch, View } from 'react-native';

import { useTokens } from '@/theme/theme-provider';

import { Icon, type IconProps } from './icon';
import { Text } from './text';

/**
 * Toggle / switch (DESIGN.md §8.5). Track turns biro when on. Optionally a full
 * labelled row (icon + title + helper) for the channel/settings lists.
 */

export function Toggle({
  value,
  onValueChange,
  disabled,
}: {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  const tokens = useTokens();
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: tokens.borderStrong, true: tokens.biro }}
      thumbColor={tokens.surface}
      ios_backgroundColor={tokens.borderStrong}
    />
  );
}

export function ToggleRow({
  title,
  helper,
  icon,
  value,
  onValueChange,
  disabled,
}: {
  title: string;
  helper?: string;
  icon?: IconProps['icon'];
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View className="flex-row items-center gap-3 py-3">
      {icon ? <Icon icon={icon} size={20} /> : null}
      <View className="flex-1">
        <Text variant="body">{title}</Text>
        {helper ? (
          <Text variant="caption" className="mt-0.5 text-ink-muted">
            {helper}
          </Text>
        ) : null}
      </View>
      <Toggle value={value} onValueChange={onValueChange} disabled={disabled} />
    </View>
  );
}
