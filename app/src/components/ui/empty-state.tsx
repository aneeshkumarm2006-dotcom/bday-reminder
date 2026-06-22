import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useTokens } from '@/theme/theme-provider';

import { Icon, type IconProps } from './icon';
import { Text } from './text';

/**
 * Empty state (DESIGN.md §8.10). An invitation, not decoration: muted icon →
 * sentence-case heading → one supporting line → the next action(s) as children.
 */
export function EmptyState({
  icon,
  title,
  body,
  children,
}: {
  icon: IconProps['icon'];
  title: string;
  body: string;
  children?: ReactNode;
}) {
  const tokens = useTokens();
  return (
    <View className="flex-1 items-center justify-center px-6">
      <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-surface-sunken">
        <Icon icon={icon} size={24} color={tokens.inkMuted} />
      </View>
      <Text variant="heading" className="text-center">
        {title}
      </Text>
      <Text variant="body" className="mt-2 text-center text-ink-secondary">
        {body}
      </Text>
      {children ? <View className="mt-6 w-full max-w-[320px] gap-2">{children}</View> : null}
    </View>
  );
}
