import { View } from 'react-native';

import { Input, Label, Select, Text, type SelectOption } from '@/components/ui';

/**
 * A month / day / optional-year date entry (FR-14/15). Lifted out of add-person
 * once four screens needed the same three controls - the person form, signup,
 * settings, and the invite step where you share your own birthday.
 *
 * Values are held as strings by the caller, matching how the forms already track
 * them: a partially-typed date is a real state a controlled number field can't
 * represent, and parsing happens once at submit.
 */

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const MONTH_OPTIONS: SelectOption[] = MONTHS.map((label, i) => ({
  label,
  value: String(i + 1),
}));

/** Days per month, February at its leap-year maximum (the year may be unknown). */
export const MAX_DAY = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

export const FEB29_OPTIONS: SelectOption[] = [
  { label: 'Feb 28 in common years', value: 'feb28' },
  { label: 'Mar 1 in common years', value: 'mar1' },
  { label: 'Only in leap years', value: 'feb29only' },
];

/** The three fields as the forms hold them - empty string means "not typed yet". */
export type DatePartsStrings = { month: string; day: string; year: string };

export const EMPTY_DATE_PARTS: DatePartsStrings = { month: '', day: '', year: '' };

/** Whether a month + day have been chosen (the year stays optional, FR-14). */
export function isCompleteDate(value: DatePartsStrings): boolean {
  return value.month !== '' && value.day !== '';
}

/** Parse to the API shape, or null when the month/day aren't filled in. */
export function toDateParts(
  value: DatePartsStrings,
): { month: number; day: number; year: number | null } | null {
  if (!isCompleteDate(value)) return null;
  return {
    month: Number(value.month),
    day: Number(value.day),
    year: value.year ? Number(value.year) : null,
  };
}

/** Seed the fields from an API date (or leave them empty when there isn't one). */
export function fromDateParts(
  dob: { month: number; day: number; year: number | null } | null | undefined,
): DatePartsStrings {
  if (!dob) return EMPTY_DATE_PARTS;
  return { month: String(dob.month), day: String(dob.day), year: dob.year ? String(dob.year) : '' };
}

/**
 * Accessible names for the three controls.
 *
 * The default leaves the month Select unnamed on purpose: it takes its
 * accessible name from the rendered "Month" placeholder, and the add-person
 * screen (plus the e2e that drives it) has always relied on that. Screens that
 * want distinct names - two date fields on one page, or a birthday that should
 * read as such - pass their own.
 */
export type DateFieldLabels = { month?: string; day: string; year: string };

const DEFAULT_LABELS: DateFieldLabels = {
  month: undefined,
  day: 'Day of birth',
  year: 'Year of birth (optional)',
};

export function DatePartsField({
  label = 'Date of birth',
  optional,
  value,
  onChange,
  hint = "Year is optional; leave it blank if you don't know it.",
  error,
  yearError,
  a11y = DEFAULT_LABELS,
  feb29Rule,
  onFeb29RuleChange,
}: {
  label?: string;
  optional?: boolean;
  value: DatePartsStrings;
  onChange: (next: DatePartsStrings) => void;
  hint?: string;
  error?: string;
  yearError?: string;
  a11y?: DateFieldLabels;
  /** Pass both to reveal the Feb-29 observance picker on Feb 29 (FR-15). */
  feb29Rule?: string;
  onFeb29RuleChange?: (rule: string) => void;
}) {
  const isLeapDay = value.month === '2' && value.day === '29';
  const showFeb29 = isLeapDay && feb29Rule !== undefined && !!onFeb29RuleChange;

  return (
    <>
      <View>
        <Label optional={optional}>{label}</Label>
        <View className="flex-row gap-2">
          <View className="flex-1">
            <Select
              value={value.month || undefined}
              options={MONTH_OPTIONS}
              onChange={(month) => onChange({ ...value, month })}
              placeholder="Month"
              accessibilityLabel={a11y.month}
            />
          </View>
          <View className="w-[72px]">
            <Input
              value={value.day}
              onChangeText={(day) => onChange({ ...value, day })}
              placeholder="Day"
              keyboardType="number-pad"
              maxLength={2}
              error={!!error}
              accessibilityLabel={a11y.day}
            />
          </View>
          <View className="w-[92px]">
            <Input
              value={value.year}
              onChangeText={(year) => onChange({ ...value, year })}
              placeholder="Year"
              keyboardType="number-pad"
              maxLength={4}
              error={!!yearError}
              accessibilityLabel={a11y.year}
            />
          </View>
        </View>
        {error ? (
          <Text variant="caption" className="mt-1.5 text-danger-fg">
            {error}
          </Text>
        ) : yearError ? (
          <Text variant="caption" className="mt-1.5 text-danger-fg">
            {yearError}
          </Text>
        ) : hint ? (
          <Text variant="caption" className="mt-1.5 text-ink-muted">
            {hint}
          </Text>
        ) : null}
      </View>

      {showFeb29 ? (
        <Select
          label="Observe this birthday"
          value={feb29Rule}
          options={FEB29_OPTIONS}
          onChange={onFeb29RuleChange}
        />
      ) : null}
    </>
  );
}
