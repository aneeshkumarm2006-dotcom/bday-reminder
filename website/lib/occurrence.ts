import { monthAbbr } from "@/lib/dates";
import type { RingState } from "@/components/ring";

/**
 * Helpers that turn the backend's occurrence data into Ring props. The API
 * sends `occurrenceDate` as an ISO string and `daysRemaining` already computed
 * server-side (the source of truth for scheduling), so we only parse the
 * calendar parts for display — taking the YYYY-MM-DD prefix to avoid the
 * UTC-midnight-rolls-back-a-day trap of `new Date(iso)` in negative offsets.
 */
export function occurrenceParts(iso: string): { day: number; month: string } {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) {
    return { day: Number(m[3]), month: monthAbbr(Number(m[2])) };
  }
  const d = new Date(iso);
  return { day: d.getDate(), month: monthAbbr(d.getMonth() + 1) };
}

/** Ring state from server-computed days-remaining (done is decided elsewhere). */
export function ringStateFromDays(daysRemaining: number): RingState {
  if (daysRemaining === 0) return "today";
  return daysRemaining < 0 ? "past" : "upcoming";
}
