"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, List } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * The shared calendar controls bar, above both the month grid and the agenda
 * list. Top row: a Month / List view toggle and a "Today" jump. Bottom row: the
 * month-nav arrows around a pressable title that opens the month/year picker.
 * Web port of app/src/components/calendar-nav.tsx.
 */

export type CalendarMode = "month" | "list";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
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
    <div className="mb-3 flex flex-col gap-3">
      {/* View toggle + Today */}
      <div className="flex items-center justify-between">
        <div className="inline-flex rounded-md border border-border-subtle bg-surface p-0.5">
          <ModeButton
            label="Month"
            icon={CalendarDays}
            active={mode === "month"}
            onClick={() => onModeChange("month")}
          />
          <ModeButton
            label="List"
            icon={List}
            active={mode === "list"}
            onClick={() => onModeChange("list")}
          />
        </div>

        <button
          type="button"
          onClick={onToday}
          className="inline-flex h-9 items-center rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken"
        >
          Today
        </button>
      </div>

      {/* Month navigation with a tappable title (opens the picker) */}
      <div className="flex items-center justify-between">
        <NavButton icon={ChevronLeft} label="Previous month" onClick={onPrev} />
        <button
          type="button"
          onClick={onOpenPicker}
          aria-label={`${MONTH_NAMES[month - 1]} ${year}, change month`}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 transition-colors hover:bg-surface-sunken"
        >
          <h2 className="font-display text-lg font-semibold text-ink">
            {`${MONTH_NAMES[month - 1]} ${year}`}
          </h2>
          <ChevronDown size={18} className="text-ink-secondary" aria-hidden="true" />
        </button>
        <NavButton icon={ChevronRight} label="Next month" onClick={onNext} />
      </div>
    </div>
  );
}

function ModeButton({
  label,
  icon: Icon,
  active,
  onClick,
}: {
  label: string;
  icon: typeof CalendarDays;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-biro text-paper" : "text-ink-secondary hover:text-ink",
      )}
    >
      <Icon size={16} aria-hidden="true" />
      {label}
    </button>
  );
}

function NavButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: typeof ChevronLeft;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
    >
      <Icon size={20} aria-hidden="true" />
    </button>
  );
}
