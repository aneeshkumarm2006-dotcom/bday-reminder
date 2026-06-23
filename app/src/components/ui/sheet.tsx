import { X } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cn, focusRing } from '@/lib/cn';
import { useFloatingShadow } from '@/theme/theme-provider';

import { Icon } from './icon';
import { Text } from './text';

/**
 * Bottom sheet / modal (DESIGN.md §8, §9). Rises from the bottom over a dimmed
 * backdrop; tapping the backdrop or the close affordance dismisses it. radius-xl
 * top corners, surface over the dimmed paper, floating shadow.
 */
export function Sheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const shadow = useFloatingShadow();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      statusBarTranslucent>
      <Pressable className="flex-1 justify-end bg-black/40" onPress={onClose}>
        <Pressable
          // Stop taps inside the sheet from closing it.
          onPress={(e) => e.stopPropagation()}
          style={[{ paddingBottom: insets.bottom + 12 }, shadow]}
          className="rounded-t-xl bg-surface">
          <View className="items-center pt-2.5">
            <View className="h-1 w-9 rounded-full bg-border-strong" />
          </View>
          {title ? (
            <View className="flex-row items-center justify-between px-5 pb-1 pt-3">
              <Text variant="heading">{title}</Text>
              <Pressable
                onPress={onClose}
                hitSlop={10}
                accessibilityRole="button"
                accessibilityLabel="Close"
                className={cn('rounded-full', focusRing)}>
                <Icon icon={X} size={20} />
              </Pressable>
            </View>
          ) : null}
          <View className="px-5 pb-2 pt-2">{children}</View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}
