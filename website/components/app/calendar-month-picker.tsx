"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { Dialog } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * A quick month + year picker (modal), opened by clicking the calendar title.
 * Step the year with the chevrons, click a month to jump there. Faster than
 * paging prev/next when the target is months or years away. Web port of the
 * app's bottom-sheet picker.
 */

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

export function CalendarMonthPicker({
  open,
  year,
  month,
  onClose,
  onPick,
}: {
  open: boolean;
  /** The currently displayed year/month (highlighted). */
  year: number;
  month: number;
  onClose: () => void;
  onPick: (next: { year: number; month: number }) => void;
}) {
  // The year the month grid is showing; re-seeded from the displayed year each
  // time the dialog opens so it always starts where the user is.
  const [pickerYear, setPickerYear] = useState(year);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) setPickerYear(year);
  }, [open, year]);

  return (
    <Dialog open={open} onClose={onClose} title="Jump to month" className="sm:max-w-sm">
      {/* Year stepper */}
      <div className="flex items-center justify-center gap-6 pb-4">
        <button
          type="button"
          onClick={() => setPickerYear((y) => y - 1)}
          aria-label="Previous year"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <ChevronLeft size={20} aria-hidden="true" />
        </button>
        <span className="font-display text-lg font-semibold tabular-nums text-ink">{pickerYear}</span>
        <button
          type="button"
          onClick={() => setPickerYear((y) => y + 1)}
          aria-label="Next year"
          className="inline-flex h-9 w-9 items-center justify-center rounded-full text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink"
        >
          <ChevronRight size={20} aria-hidden="true" />
        </button>
      </div>

      {/* Month grid (3 columns) */}
      <div className="grid grid-cols-3 gap-2">
        {MONTHS_SHORT.map((label, i) => {
          const m = i + 1;
          const isSelected = pickerYear === year && m === month;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onPick({ year: pickerYear, month: m })}
              aria-pressed={isSelected}
              aria-label={`${label} ${pickerYear}`}
              className={cn(
                "rounded-md border py-2.5 text-sm font-medium transition-colors",
                isSelected
                  ? "border-biro bg-biro text-paper"
                  : "border-border-subtle bg-surface text-ink hover:bg-surface-sunken",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>
    </Dialog>
  );
}
