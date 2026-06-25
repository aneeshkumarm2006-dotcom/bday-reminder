import type { ReactNode } from 'react';
import { View } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { cn } from '@/lib/cn';

/**
 * Screen container - warm `paper` background, safe-area aware, single column
 * centered to 560px on web (DESIGN.md §5). Wrap a `ScrollView` inside for long
 * content.
 */
export function Screen({
  children,
  edges = ['top'],
  padded = true,
  className,
}: {
  children: ReactNode;
  edges?: readonly Edge[];
  padded?: boolean;
  className?: string;
}) {
  return (
    <View className="flex-1 bg-paper">
      <SafeAreaView edges={edges} style={{ flex: 1 }}>
        <View className={cn('mx-auto w-full max-w-[560px] flex-1', padded && 'px-5', className)}>
          {children}
        </View>
      </SafeAreaView>
    </View>
  );
}
