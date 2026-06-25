import { View } from 'react-native';

import { Text } from '@/components/ui';
import type { ListMember } from '@/lib/api';

/**
 * Overlapping member avatars (DESIGN.md §8.9). Perfect circles (never a ring -
 * §1), initials on surface-sunken. Shows up to `max`, then a "+N" disc. Used in
 * the lists index and the list header.
 */

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? '').join('') || '?';
}

export function MemberAvatars({ members, max = 4 }: { members: ListMember[]; max?: number }) {
  const shown = members.slice(0, max);
  const overflow = members.length - shown.length;

  return (
    <View className="flex-row items-center">
      {shown.map((member, i) => (
        <View
          key={member.id}
          style={{ marginLeft: i === 0 ? 0 : -8 }}
          className="h-8 w-8 items-center justify-center rounded-full border border-surface bg-surface-sunken">
          <Text variant="caption" className="text-ink-secondary">
            {initials(member.name)}
          </Text>
        </View>
      ))}
      {overflow > 0 ? (
        <View
          style={{ marginLeft: -8 }}
          className="h-8 w-8 items-center justify-center rounded-full border border-surface bg-surface-sunken">
          <Text variant="caption" tabularNums className="text-ink-secondary">
            +{overflow}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
