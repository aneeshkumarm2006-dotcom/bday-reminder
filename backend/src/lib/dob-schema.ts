import { z } from 'zod';

import { maxDayInMonth } from './dates';
import type { DateParts } from '../models/common';

/**
 * The shared date-of-birth request shape (FR-14/15). Originally lived in
 * `routes/people.ts`; it moved here once a birthday stopped being a
 * people-only concept - `User.birthday` (signup, PATCH /me, invite accept)
 * validates against exactly the same rules, and a second copy of the
 * day-in-month refine would drift.
 */

const CURRENT_YEAR = new Date().getUTCFullYear();

export const dobSchema = z
  .object({
    month: z.number().int().min(1, 'Pick a month.').max(12, 'Pick a month.'),
    day: z.number().int().min(1, 'Pick a day.').max(31, 'Pick a day.'),
    // Year is optional (FR-14); reject the future and absurdly old years.
    year: z
      .number()
      .int()
      .min(1900)
      .max(CURRENT_YEAR, 'That year is in the future.')
      .nullable()
      .optional(),
  })
  .refine((d) => d.day <= maxDayInMonth(d.month), {
    message: "That day doesn't exist in the chosen month.",
    path: ['day'],
  });

export type DobInput = z.infer<typeof dobSchema>;

/**
 * Request shape → stored shape. The wire uses `year: null` for "unknown"
 * (JSON has no undefined), while the DateParts subdocument leaves it unset -
 * storing an explicit null would fail the `min: 1900` validator.
 */
export function toDateParts(input: DobInput): DateParts {
  return { month: input.month, day: input.day, year: input.year ?? undefined };
}
