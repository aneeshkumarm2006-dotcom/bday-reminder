import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, List } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { cn, focusRing } from '@/lib/cn';
import { useTokens } from '@/theme/theme-provider';

/**
 * The shared calendar controls bar, above both the month grid and the agenda
 * list. Top row: a Month / List view toggle and a "Today" jump. Bottom row: the
 * month-nav arrows around a pressable title that opens the month/year picker.
 */

export type CalendarMode = 'month' | 'list';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export function CalendarNav({
  year,
  month,
  mode,
  onModeChange,
  onPrev,
  onNext,
  onToday,
  onOpenPicker,
}: {
  year: number;
  month: number;
  mode: CalendarMode;
  onModeChange: (mode: CalendarMode) => void;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenPicker: () => void;
}) {
  return (
    <View className="gap-3 pb-2">
      {/* View toggle + Today */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row rounded-md border border-border-subtle bg-surface p-0.5">
          <ModeButton
            label="Month"
            icon={CalendarDays}
            active={mode === 'month'}
            onPress={() => onModeChange('month')}
          />
          <ModeButton
            label="List"
            icon={List}
            active={mode === 'list'}
            onPress={() => onModeChange('list')}
          />
        </View>

        <Pressable
          onPress={onToday}
          accessibilityRole="button"
          accessibilityLabel="Jump to today"
          className={cn(
            'rounded-md border border-border-strong bg-surface px-3 py-1.5 active:scale-95',
            focusRing,
          )}>
          <Text variant="button" className="text-ink">
            Today
          </Text>
        </Pressable>
      </View>

      {/* Month navigation with a tappable title (opens the picker) */}
      <View className="flex-row items-center justify-between">
        <NavButton icon={ChevronLeft} label="Previous month" onPress={onPrev} />
        <Pressable
          onPress={onOpenPicker}
          accessibilityRole="button"
          accessibilityLabel={`${MONTH_NAMES[month - 1]} ${year}, change month`}
          className={cn('flex-row items-center gap-1 rounded-md px-2 py-1 active:scale-95', focusRing)}>
          <Text variant="heading">{`${MONTH_NAMES[month - 1]} ${year}`}</Text>
          <Icon icon={ChevronDown} size={20} />
        </Pressable>
        <NavButton icon={ChevronRight} label="Next month" onPress={onNext} />
      </View>
    </View>
  );
}

function ModeButton({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: typeof CalendarDays;
  active: boolean;
  onPress: () => void;
}) {
  const t = useTokens();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={`${label} view`}
      className={cn(
        'flex-row items-center gap-1.5 rounded px-3 py-1.5',
        active ? 'bg-biro' : undefined,
        focusRing,
      )}>
      <Icon icon={icon} size={16} color={active ? t.paper : t.inkSecondary} />
      <Text variant="button" className={active ? 'text-paper' : 'text-ink-secondary'}>
        {label}
      </Text>
    </Pressable>
  );
}

function NavButton({
  icon,
  label,
  onPress,
}: {
  icon: typeof ChevronLeft;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      hitSlop={10}
      accessibilityRole="button"
      accessibilityLabel={label}
      className={cn('h-9 w-9 items-center justify-center rounded-full active:scale-95', focusRing)}>
      <Icon icon={icon} size={22} />
    </Pressable>
  );
}
