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

const MONTHS = Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: monthAbbr(i + 1) }));

/** Days in a month for the day dropdown; defaults to 31, narrows when month known. */
function daysInMonth(month: number, year: number | null): number {
  if (month === 2) return year && (year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0)) ? 29 : 29;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function DatePartsField({
  value,
  onChange,
  label = "Date",
}: {
  value: DatePartsValue;
  onChange: (next: DatePartsValue) => void;
  label?: string;
}) {
  const maxDay = daysInMonth(value.month, value.year);
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-ink-secondary">{label}</label>
      <div className="grid grid-cols-[1.2fr_1fr_1fr] gap-2">
        <Select
          aria-label="Month"
          value={value.month}
          onChange={(e) => onChange({ ...value, month: Number(e.target.value) })}
        >
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
      <p className="mt-1.5 text-xs text-ink-muted">Year is optional — leave it blank if you don&apos;t know it.</p>
    </div>
  );
}
