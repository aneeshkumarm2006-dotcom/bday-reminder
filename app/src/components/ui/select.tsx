import { Check, ChevronDown } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { cn, focusRing } from '@/lib/cn';
import { useTokens } from '@/theme/theme-provider';

import { Icon } from './icon';
import { Label } from './input';
import { Sheet } from './sheet';
import { Text } from './text';

/**
 * Select (DESIGN.md §8). A field-styled trigger that opens a bottom sheet of
 * options; the current value gets a biro check. Keeps the native feel without a
 * platform picker.
 */

export type SelectOption = { label: string; value: string };

export function Select({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  label,
}: {
  value?: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}) {
  const tokens = useTokens();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <View>
      {label ? <Label>{label}</Label> : null}
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityValue={{ text: selected?.label ?? placeholder }}
        className={cn(
          'min-h-[44px] flex-row items-center justify-between rounded-md border border-border-strong bg-surface px-3',
          focusRing,
        )}>
        <Text variant="body" className={selected ? 'text-ink' : 'text-ink-muted'}>
          {selected?.label ?? placeholder}
        </Text>
        <Icon icon={ChevronDown} size={20} color={tokens.inkMuted} />
      </Pressable>

      <Sheet visible={open} onClose={() => setOpen(false)} title={label ?? 'Select'}>
        {/* Cap the height so long lists (e.g. the 48-slot time picker) scroll
            inside the sheet instead of overflowing the screen. */}
        <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
          {options.map((option) => {
            const isSelected = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                className={cn(
                  'min-h-[48px] flex-row items-center justify-between border-b border-border-subtle',
                  focusRing,
                )}>
                <Text variant="body" className={isSelected ? 'text-ink' : 'text-ink-secondary'}>
                  {option.label}
                </Text>
                {isSelected ? <Icon icon={Check} size={20} color={tokens.biro} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </Sheet>
    </View>
  );
}
