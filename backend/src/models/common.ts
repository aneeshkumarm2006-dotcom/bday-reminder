import { Schema } from 'mongoose';

/** A birthday/event date - month + day required, year optional (PRD FR-14). */
export interface DateParts {
  month: number; // 1-12
  day: number; // 1-31
  year?: number;
}

/** Embedded date subdocument factory (no own _id). */
export function dateParts(required: boolean) {
  return new Schema<DateParts>(
    {
      month: { type: Number, required, min: 1, max: 12 },
      day: { type: Number, required, min: 1, max: 31 },
      year: { type: Number, min: 1900, max: 3000 },
    },
    { _id: false },
  );
}

/** How to observe a Feb-29 birthday in non-leap years (PRD FR-15). */
export type Feb29Rule = 'feb28' | 'feb29only' | 'mar1';
export const FEB29_RULES: Feb29Rule[] = ['feb28', 'feb29only', 'mar1'];

export type ChannelKey = 'push' | 'email' | 'sms' | 'inApp';
export const CHANNEL_KEYS: ChannelKey[] = ['push', 'email', 'sms', 'inApp'];
