import { countryCodeForTimeZone, dialCodeFor } from './countries';

/**
 * Phone normalization. Phones are stored in E.164 (`+<country><digits>`) because
 * that is the only shape Twilio accepts reliably for the auto-send birthday text
 * (Stage 15), and the one the day-of "Send greeting" `sms:` link works best with
 * (FR-28/29).
 *
 * The clients now pair every phone field with a country picker and POST a full
 * E.164 string, so the interesting case here is input that arrives WITHOUT a
 * country code: CSV/Google imports and older clients. Twilio is provisioned
 * beyond the US/CA now, so a bare 10-digit number can no longer be assumed to be
 * North American - callers pass the account owner's `defaultDialCode` (derived
 * from their timezone) and the number is completed with that instead of a blind
 * `+1`.
 *
 * Normalization stays SOFT throughout: anything already internationalized is
 * kept, and anything that can't be completed confidently is passed through
 * untouched rather than rejected or mangled. The reminder engine skips sending
 * to non-E.164 numbers, so a pass-through degrades to "no auto-text", never to a
 * text delivered to the wrong country.
 */

/** Fallback dial code when the owner's country can't be determined (US/CA). */
const DEFAULT_DIAL_CODE = '1';

/**
 * The dial code to complete a country-code-less number with, from the account
 * owner's IANA timezone (which the app reports from the device). Falls back to
 * the US/CA `+1` soft default.
 */
export function defaultDialCode(timezone: string | null | undefined): string {
  const code = countryCodeForTimeZone(timezone);
  return code ? dialCodeFor(code) : DEFAULT_DIAL_CODE;
}

/**
 * Drop the national trunk prefix (a leading `0`) that many countries write in
 * their local format but that E.164 omits - "07700 900123" is "+447700900123".
 * Italy is the documented exception: its landline numbers keep the leading zero.
 */
function stripTrunkPrefix(digits: string, dial: string): string {
  if (dial === '39') return digits;
  return digits.replace(/^0+/, '');
}

/**
 * Normalize a phone number for storage. Returns E.164 when the country is known
 * or can be completed from `dial`; passes anything else through trimmed.
 * Empty/nullish input returns null (clears the field).
 *
 *   "+44 20 7946 0958"            → "+442079460958"
 *   "(415) 555-0142"              → "+14155550142"
 *   "1 415 555 0142"              → "+14155550142"
 *   "98765 43210", dial "91"      → "+919876543210"
 *   "07700 900123", dial "44"     → "+447700900123"
 *   "12345" / "ext. 5"            → unchanged (soft: never reject, never guess)
 */
export function normalizePhone(
  input: string | null | undefined,
  dial: string = DEFAULT_DIAL_CODE,
): string | null {
  if (input == null) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Already internationalized: keep the leading '+', drop separators.
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    return digits ? `+${digits}` : trimmed;
  }

  const digits = trimmed.replace(/\D/g, '');

  // NANP (US + Canada share +1): a bare 10-digit number, or 11 digits behind the
  // '1' trunk/country digit.
  if (dial === '1') {
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return trimmed;
  }

  const national = stripTrunkPrefix(digits, dial);
  // Some sources export a country code without the '+'. Only read it as one when
  // what follows is still long enough to be a national number on its own.
  if (national.startsWith(dial) && national.length - dial.length >= 8) return `+${national}`;
  // E.164 allows 15 digits total; anything shorter than 6 is an extension or a
  // short code, not a number we could text.
  if (national.length >= 6 && national.length + dial.length <= 15) return `+${dial}${national}`;

  // Anything else: leave the user's input as-is (don't guess a country code).
  return trimmed;
}
