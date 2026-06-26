/**
 * Phone display helpers, US/CA-first. The backend stores numbers in E.164
 * (`+1XXXXXXXXXX` for the North American Numbering Plan shared by the US and
 * Canada — see `backend/src/lib/phone.ts`). This formats a stored NANP number
 * back into the familiar `(XXX) XXX-XXXX` shape for the edit form, and leaves
 * any other (international) number as-is so nothing is mangled.
 */

/**
 * Format a stored number for display.
 *   "+14155550142" → "(415) 555-0142"
 *   "+442079460958" → "+442079460958" (non-NANP: shown as stored)
 */
export function formatNanp(value: string | null | undefined): string {
  if (!value) return '';
  const v = value.trim();
  const m = v.match(/^\+1(\d{3})(\d{3})(\d{4})$/);
  return m ? `(${m[1]}) ${m[2]}-${m[3]}` : v;
}
