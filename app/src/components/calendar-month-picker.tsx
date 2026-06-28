import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Icon, Sheet, Text } from '@/components/ui';
import { cn, focusRing } from '@/lib/cn';

/**
 * A quick month + year picker (bottom sheet), opened by tapping the calendar
 * title. Step the year with the chevrons, tap a month to jump there. Faster than
 * paging prev/next when the target is months or years away.
 */

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

export function CalendarMonthPicker({
  visible,
  year,
  month,
  onClose,
  onPick,
}: {
  visible: boolean;
  /** The currently displayed year/month (highlighted). */
  year: number;
  month: number;
  onClose: () => void;
  onPick: (next: { year: number; month: number }) => void;
}) {
  // The year the grid of months is showing; re-seeded from the displayed year
  // each time the sheet opens so it always starts where the user is.
  const [pickerYear, setPickerYear] = useState(year);
  useEffect(() => {
    if (visible) setPickerYear(year);
  }, [visible, year]);

  return (
    <Sheet visible={visible} onClose={onClose} title="Jump to month">
      <View>
        {/* Year stepper */}
        <View className="flex-row items-center justify-center gap-6 pb-3">
          <StepButton
            icon={ChevronLeft}
            label="Previous year"
            onPress={() => setPickerYear((y) => y - 1)}
          />
          <Text variant="heading" tabularNums>
            {pickerYear}
          </Text>
          <StepButton
            icon={ChevronRight}
            label="Next year"
            onPress={() => setPickerYear((y) => y + 1)}
          />
        </View>

        {/* Month grid (3 columns) */}
        <View className="flex-row flex-wrap">
          {MONTHS_SHORT.map((label, i) => {
            const m = i + 1;
            const isSelected = pickerYear === year && m === month;
            return (
              <View key={label} style={{ width: '33.3333%' }} className="p-1">
                <Pressable
                  onPress={() => onPick({ year: pickerYear, month: m })}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isSelected }}
                  accessibilityLabel={`${label} ${pickerYear}`}
                  className={cn(
                    'items-center justify-center rounded-md border py-3',
                    isSelected
                      ? 'border-biro bg-biro'
                      : 'border-border-subtle bg-surface active:bg-surface-sunken',
                    focusRing,
                  )}>
                  <Text variant="button" className={isSelected ? 'text-paper' : 'text-ink'}>
                    {label}
                  </Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      </View>
    </Sheet>
  );
}

function StepButton({
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
