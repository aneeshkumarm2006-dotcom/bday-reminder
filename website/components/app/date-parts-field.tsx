"use client";

import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { monthAbbr } from "@/lib/dates";

/**
 * Month / day / (optional) year picker — the shared date control for birthdays
 * and events (FR-13/14). Year is optional: leave it blank when unknown, never
 * guess (FR-14). Controlled; emits a partial {month, day, year}.
 */
export type DatePartsValue = { month: number; day: number; year: number | null };

/** A date that hasn't been filled in yet — only valid with `allowEmpty`. */
export const EMPTY_DATE_PARTS: DatePartsValue = { month: 0, day: 0, year: null };

/** Whether a month + day have been chosen (the year stays optional, FR-14). */
export function isCompleteDateParts(value: DatePartsValue): boolean {
  return value.month > 0 && value.day > 0;
}

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: monthAbbr(i + 1) }));

/**
 * Days in a month for the day dropdown; 31 until the month is known. February
 * always offers 29 — the year is optional, so a leap-day birthday has to be
 * selectable even when we can't tell whether that year had one (FR-15).
 */
function daysInMonth(month: number): number {
  if (month === 0) return 31;
  if (month === 2) return 29;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function DatePartsField({
  value,
  onChange,
  label = "Date",
  allowEmpty = false,
  helper = "Year is optional — leave it blank if you don't know it.",
}: {
  value: DatePartsValue;
  onChange: (next: DatePartsValue) => void;
  label?: string;
  /**
   * Offer a blank month/day so the field can express "not given yet". Needed
   * wherever a date is being collected rather than edited — signup, settings,
   * the invite step — since a pre-selected January 1 would be a guess.
   */
  allowEmpty?: boolean;
  helper?: string;
}) {
  const maxDay = daysInMonth(value.month);
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink-secondary">{label}</label>
      <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-2">
        <Select
          aria-label="Month"
          value={value.month}
          onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
        >
          {allowEmpty ? <option value={0}>Month</option> : null}
          {MONTHS.map((m) => (
            <option key={m.value} value={m.value}>
              {m.label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="Day"
          value={value.day}
          onChange={(e) => onChange({ ...value, day: Number(e.target.value) })}
        >
          {allowEmpty ? <option value={0}>Day</option> : null}
          {Array.from({ length: maxDay }, (_, i) => i + 1).map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </Select>
        <Input
          aria-label="Year (optional)"
          type="number"
          inputMode="numeric"
          placeholder="Year"
          value={value.year ?? ""}
          onChange={(e) => {
            const raw = e.target.value.trim();
            onChange({ ...value, year: raw === "" ? null : Number(raw) });
          }}
        />
      </div>
      {helper ? <p className="mt-1.5 text-xs text-ink-muted">{helper}</p> : null}
    </div>
  );
}
