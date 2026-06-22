import { useState } from 'react';
import { View } from 'react-native';

import {
  Button,
  Chip,
  Input,
  Label,
  Select,
  Sheet,
  Text,
  TextField,
  useToast,
  type SelectOption,
} from '@/components/ui';
import { ApiError, eventsApi } from '@/lib/api';

/**
 * Add an Anniversary or Custom event to a person (DESIGN.md §8.6, PRD §8.4;
 * FR-16/18). Opened from the profile's dashed "Add event" row. Month + day are
 * required, year optional (mirrors the DOB rule); a custom event needs a name.
 * Each new event reminds/recurs independently under the same rules as the
 * birthday.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTH_OPTIONS: SelectOption[] = MONTHS.map((label, i) => ({ label, value: String(i + 1) }));
const MAX_DAY = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
const CURRENT_YEAR = new Date().getFullYear();

type EventErrors = { name?: string; dob?: string; year?: string };

export function AddEventSheet({
  visible,
  personId,
  onClose,
  onCreated,
}: {
  visible: boolean;
  personId: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const toast = useToast();

  const [type, setType] = useState<'anniversary' | 'custom'>('anniversary');
  const [customName, setCustomName] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  const [errors, setErrors] = useState<EventErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const reset = () => {
    setType('anniversary');
    setCustomName('');
    setMonth('');
    setDay('');
    setYear('');
    setErrors({});
    setSubmitError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = async () => {
    setSubmitError(null);
    const next: EventErrors = {};
    const m = parseInt(month, 10);
    const d = parseInt(day, 10);

    if (type === 'custom' && !customName.trim()) next.name = 'Name this event so you know what it is.';
    if (!month) next.dob = 'Pick a month.';
    else if (!day.trim() || Number.isNaN(d) || d < 1 || d > 31) next.dob = 'Enter a day from 1 to 31.';
    else if (d > MAX_DAY[m - 1]) next.dob = "That day doesn't exist in that month.";

    let parsedYear: number | null = null;
    if (year.trim()) {
      const y = parseInt(year, 10);
      if (Number.isNaN(y) || y < 1900 || y > CURRENT_YEAR)
        next.year = `Enter a year between 1900 and ${CURRENT_YEAR}.`;
      else parsedYear = y;
    }

    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await eventsApi.create({
        person: personId,
        type,
        customName: type === 'custom' ? customName.trim() : null,
        date: { month: m, day: d, year: parsedYear },
      });
      onCreated();
      toast.show('Event added.');
      close();
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "Couldn't add the event. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={close} title="Add event">
      <View className="gap-4 pb-2">
        <View>
          <Label>Type</Label>
          <View className="flex-row gap-2">
            <Chip
              label="Anniversary"
              selected={type === 'anniversary'}
              onPress={() => setType('anniversary')}
            />
            <Chip label="Custom" selected={type === 'custom'} onPress={() => setType('custom')} />
          </View>
        </View>

        {type === 'custom' ? (
          <TextField
            label="Event name"
            value={customName}
            onChangeText={setCustomName}
            placeholder="e.g. Met on this day"
            error={errors.name}
            autoCapitalize="sentences"
            maxLength={60}
          />
        ) : null}

        <View>
          <Label>Date</Label>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Select
                value={month || undefined}
                options={MONTH_OPTIONS}
                onChange={setMonth}
                placeholder="Month"
              />
            </View>
            <View className="w-[72px]">
              <Input
                value={day}
                onChangeText={setDay}
                placeholder="Day"
                keyboardType="number-pad"
                maxLength={2}
                error={!!errors.dob}
                accessibilityLabel="Day"
              />
            </View>
            <View className="w-[92px]">
              <Input
                value={year}
                onChangeText={setYear}
                placeholder="Year"
                keyboardType="number-pad"
                maxLength={4}
                error={!!errors.year}
                accessibilityLabel="Year (optional)"
              />
            </View>
          </View>
          {errors.dob ? (
            <Text variant="caption" className="mt-1.5 text-danger-fg">
              {errors.dob}
            </Text>
          ) : errors.year ? (
            <Text variant="caption" className="mt-1.5 text-danger-fg">
              {errors.year}
            </Text>
          ) : (
            <Text variant="caption" className="mt-1.5 text-ink-muted">
              Year is optional.
            </Text>
          )}
        </View>

        {submitError ? (
          <Text variant="caption" className="text-danger-fg">
            {submitError}
          </Text>
        ) : null}

        <Button fullWidth loading={saving} onPress={submit}>
          Add event
        </Button>
      </View>
    </Sheet>
  );
}
