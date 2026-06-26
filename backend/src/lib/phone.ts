/**
 * Phone normalization, US/CA-first (a soft default). Phones are stored so the
 * day-of "Send greeting" action can open the user's messaging app with an
 * `sms:<number>` link (FR-28/29), which works most reliably with an E.164
 * number (`+<country><digits>`).
 *
 * The US and Canada share country code +1 (the North American Numbering Plan),
 * so a bare 10-digit number is assumed to be NANP and gets a `+1` prefix. This
 * is deliberately SOFT: anything already internationalized (leading `+`) is
 * kept, and anything that doesn't look like NANP is passed through untouched
 * rather than rejected or mangled, so international numbers still work.
 */

/**
 * Normalize a phone number for storage. Returns E.164 for NANP and already-
 * internationalized input; passes anything else through trimmed. Empty/nullish
 * input returns null (clears the field).
 *
 *   "(415) 555-0142"     → "+14155550142"
 *   "415-555-0142"       → "+14155550142"
 *   "1 415 555 0142"     → "+14155550142"
 *   "+44 20 7946 0958"   → "+442079460958"
 *   "12345" / "ext. 5"   → unchanged (soft: never reject a non-NANP number)
 */
export function normalizePhone(input: string | null | undefined): string | null {
  if (input == null) return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Already internationalized: keep the leading '+', drop separators.
  if (trimmed.startsWith('+')) {
    const digits = trimmed.slice(1).replace(/\D/g, '');
    return digits ? `+${digits}` : trimmed;
  }

  const digits = trimmed.replace(/\D/g, '');
  // NANP soft default (US + Canada share +1).
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;

  // Anything else: leave the user's input as-is (don't guess a country code).
  return trimmed;
}
