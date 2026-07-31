import { countryCodeForTimeZone, countryForE164, dialCodeFor } from '@/lib/countries';

/**
 * Phone helpers for the country-code picker (`components/ui/phone-input.tsx`).
 *
 * Numbers are stored in E.164 (`+<country><national>`) - the shape Twilio needs
 * for the auto-send birthday text, and the one `sms:` links work best with. Now
 * that Twilio is provisioned beyond the US/CA, a typed number can't be assumed
 * to be +1, so every phone field splits into a country and a national number and
 * recombines them here. See `backend/src/lib/phone.ts` for the server-side
 * normalization that catches anything arriving without a country code.
 */

export type PhoneParts = {
  /** ISO 3166-1 alpha-2 of the selected country, e.g. "IN". */
  country: string;
  /** National number as typed, digits only (no country code, no trunk "0"). */
  national: string;
};

/** Last-resort country when neither the account nor the device says otherwise. */
const FALLBACK_COUNTRY = 'US';

/**
 * Which country a phone field should open on: the account timezone first (the
 * app reports the device's on signup), then the device's own zone, then US/CA.
 */
export function defaultCountryCode(timezone?: string | null): string {
  const fromAccount = countryCodeForTimeZone(timezone);
  if (fromAccount) return fromAccount;
  try {
    const local = countryCodeForTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    if (local) return local;
  } catch {
    // No Intl zone available - fall through to the soft default.
  }
  return FALLBACK_COUNTRY;
}

/**
 * Split a stored number into the picker's two halves. A number without a country
 * code (a legacy row, or one typed straight into the national field) keeps
 * `fallbackCountry` so nothing is silently reassigned to another country.
 */
export function splitPhone(value: string | null | undefined, fallbackCountry: string): PhoneParts {
  const trimmed = (value ?? '').trim();
  if (!trimmed) return { country: fallbackCountry, national: '' };

  const country = countryForE164(trimmed);
  if (country) {
    const digits = trimmed.replace(/[^\d+]/g, '');
    return { country: country.code, national: digits.slice(1 + country.dial.length) };
  }
  return { country: fallbackCountry, national: trimmed.replace(/\D/g, '') };
}

/**
 * Recombine a dial code and a national number into E.164. Empty national number
 * → '' (an empty phone field clears the value rather than saving a bare "+91").
 *
 * The leading "0" many countries write locally is a national trunk prefix that
 * E.164 drops - "07700 900123" is "+447700900123". Italy is the exception: its
 * landlines keep the zero.
 */
export function toE164(dial: string, national: string): string {
  const digits = national.replace(/\D/g, '');
  const significant = dial === '39' ? digits : digits.replace(/^0+/, '');
  return significant ? `+${dial}${significant}` : '';
}

/** True once a value is a complete, sendable E.164 number. */
export function isE164(value: string | null | undefined): boolean {
  return !!value && /^\+[1-9]\d{6,14}$/.test(value.trim());
}

/**
 * Group a national number for readability while typing. NANP gets its familiar
 * "(415) 555-0142"; every other country is grouped loosely, since national
 * formats vary too much to model.
 *   ('1', '4155550142')  → '(415) 555-0142'
 *   ('91', '9876543210') → '98765 43210'
 */
export function formatNational(dial: string, national: string): string {
  const d = national.replace(/\D/g, '');
  if (dial === '1') {
    if (d.length <= 3) return d;
    if (d.length <= 6) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
  }
  if (d.length <= 5) return d;
  return `${d.slice(0, 5)} ${d.slice(5)}`.trim();
}

/**
 * Human rendering of a stored number, for prose and read-only rows.
 *   '+14155550142'  → '+1 (415) 555-0142'
 *   '+919876543210' → '+91 98765 43210'
 * Anything not in E.164 is shown exactly as stored.
 */
export function formatPhone(value: string | null | undefined): string {
  if (!value) return '';
  const trimmed = value.trim();
  const country = countryForE164(trimmed);
  if (!country) return trimmed;
  const national = trimmed.replace(/[^\d+]/g, '').slice(1 + country.dial.length);
  return `+${country.dial} ${formatNational(country.dial, national)}`.trim();
}

/** Label for a country row / trigger, e.g. "IN +91". */
export function dialLabel(countryCode: string): string {
  return `${countryCode} +${dialCodeFor(countryCode)}`;
}
