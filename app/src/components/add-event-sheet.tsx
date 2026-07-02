import { useState } from 'react';
import { View } from 'react-native';

import {
  defaultTimeInheritLabel,
  ReminderTimePicker,
} from '@/components/reminder-prefs';
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
import { ApiError, eventsApi, type CreatePersonEventInput, type EventItem } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

/**
 * Add an Anniversary or Custom event (DESIGN.md §8.6, PRD §8.4; FR-16/18).
 * Month + day are required, year optional (mirrors the DOB rule); a custom event
 * needs a name. Two modes share the same fields + validation:
 *  - API mode (person profile): pass `personId` + `onCreated`; submit calls
 *    `POST /events` right away.
 *  - Draft mode (Add person, before the person exists): pass `onAdd`; submit
 *    hands the validated draft back so the parent can create it atomically with
 *    the person. Each event reminds/recurs independently like the birthday.
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
  event,
  onClose,
  onCreated,
  onUpdated,
  onAdd,
}: {
  visible: boolean;
  onClose: () => void;
  /** API mode: the person to attach the event to (with `onCreated`). */
  personId?: string;
  /** Edit mode: the existing event to edit (with `onUpdated`). */
  event?: EventItem;
  /** API mode: called after a successful `POST /events`. */
  onCreated?: () => void;
  /** Edit mode: called after a successful `PATCH /events/:id`. */
  onUpdated?: () => void;
  /** Draft mode: receive the validated event instead of hitting the API. */
  onAdd?: (draft: CreatePersonEventInput) => void;
}) {
  const toast = useToast();
  const { user } = useAuth();
  const isEdit = !!event;

  const [type, setType] = useState<'anniversary' | 'custom'>('anniversary');
  const [customName, setCustomName] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [year, setYear] = useState('');
  // "" => inherit the user's global default reminder time; "HH:mm" => a set time.
  const [reminderTime, setReminderTime] = useState('');
  const [errors, setErrors] = useState<EventErrors>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Seed the fields from the event being edited whenever the sheet opens for it.
  // Done during render (guarded by a tracker) rather than in an effect, so it
  // doesn't trigger a setState-in-effect cascade.
  const seedKey = visible && event ? event.id : null;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (seedKey !== seededFor) {
    setSeededFor(seedKey);
    if (event && seedKey) {
      setType(event.type === 'custom' ? 'custom' : 'anniversary');
      setCustomName(event.customName ?? '');
      setMonth(String(event.date.month));
      setDay(String(event.date.day));
      setYear(event.date.year != null ? String(event.date.year) : '');
      setReminderTime(event.reminderTimeOverride ?? '');
      setErrors({});
      setSubmitError(null);
    }
  }

  const reset = () => {
    setType('anniversary');
    setCustomName('');
    setMonth('');
    setDay('');
    setYear('');
    setReminderTime('');
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

    const draft: CreatePersonEventInput = {
      type,
      customName: type === 'custom' ? customName.trim() : null,
      date: { month: m, day: d, year: parsedYear },
      reminderTimeOverride: reminderTime || null,
    };

    // Draft mode (Add person): hand the event to the parent to hold and create
    // atomically with the person - no API call, so no person exists yet.
    if (onAdd) {
      onAdd(draft);
      close();
      return;
    }

    setSaving(true);
    try {
      if (isEdit) {
        // Type can't change here; only send the fields this event type allows.
        await eventsApi.update(event.id, {
          customName: event.type === 'custom' ? customName.trim() : undefined,
          date: { month: m, day: d, year: parsedYear },
          reminderTimeOverride: reminderTime || null,
        });
        onUpdated?.();
        toast.show('Event updated.');
      } else {
        await eventsApi.create({ person: personId!, ...draft });
        onCreated?.();
        toast.show('Event added.');
      }
      close();
    } catch (e) {
      setSubmitError(e instanceof ApiError ? e.message : "Couldn't save the event. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={close} title={isEdit ? 'Edit event' : 'Add event'}>
      <View className="gap-4 pb-2">
        {!isEdit ? (
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
        ) : null}

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

        <View>
          <Label>Reminder time</Label>
          <ReminderTimePicker
            value={reminderTime}
            onChange={setReminderTime}
            inheritLabel={defaultTimeInheritLabel(user?.defaultReminderTime)}
          />
        </View>

        {submitError ? (
          <Text variant="caption" className="text-danger-fg">
            {submitError}
          </Text>
        ) : null}

        <Button fullWidth loading={saving} onPress={submit}>
          {isEdit ? 'Save changes' : 'Add event'}
        </Button>
      </View>
    </Sheet>
  );
}
