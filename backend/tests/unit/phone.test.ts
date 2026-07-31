import { describe, expect, it } from 'vitest';

import { countryForE164, dialCodeFor } from '../../src/lib/countries';
import { defaultDialCode, normalizePhone } from '../../src/lib/phone';

/**
 * Phone normalization (lib/phone.ts). The clients now send full E.164 from the
 * country picker, so what matters here is that already-internationalized input
 * survives untouched and that a country-code-less number is completed with the
 * OWNER's dial code rather than a blind +1 - Twilio is provisioned beyond the
 * US/CA, and a wrong country code is an undeliverable message.
 */

describe('normalizePhone', () => {
  it('returns null for empty / nullish input', () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone('   ')).toBeNull();
  });

  it('keeps an already-internationalized number and strips separators', () => {
    expect(normalizePhone('+44 20 7946 0958')).toBe('+442079460958');
    expect(normalizePhone('+91 98765-43210', '1')).toBe('+919876543210');
    // The picker's country wins over the caller's default, always.
    expect(normalizePhone('+919876543210', '44')).toBe('+919876543210');
  });

  it('completes a bare NANP number with +1', () => {
    expect(normalizePhone('(415) 555-0142')).toBe('+14155550142');
    expect(normalizePhone('415-555-0142')).toBe('+14155550142');
    expect(normalizePhone('1 415 555 0142')).toBe('+14155550142');
  });

  it("completes a country-code-less number with the owner's dial code", () => {
    expect(normalizePhone('98765 43210', '91')).toBe('+919876543210');
    expect(normalizePhone('20 7946 0958', '44')).toBe('+442079460958');
  });

  it('drops the national trunk 0, except for Italy where E.164 keeps it', () => {
    expect(normalizePhone('07700 900123', '44')).toBe('+447700900123');
    expect(normalizePhone('06 6982 1234', '39')).toBe('+390669821234');
  });

  it('reads a country code written without the +', () => {
    expect(normalizePhone('919876543210', '91')).toBe('+919876543210');
  });

  it('passes through anything it cannot complete confidently', () => {
    // Too short to be a number - an extension or a short code.
    expect(normalizePhone('12345', '91')).toBe('12345');
    expect(normalizePhone('ext. 5')).toBe('ext. 5');
    // On the +1 default, only NANP shapes are completed - a 9-digit number is
    // neither NANP nor confidently anything else, so it stays as typed.
    expect(normalizePhone('7946 0958')).toBe('7946 0958');
  });
});

describe('defaultDialCode', () => {
  it("uses the owner's timezone country", () => {
    expect(defaultDialCode('Asia/Kolkata')).toBe('91');
    expect(defaultDialCode('Europe/London')).toBe('44');
    expect(defaultDialCode('Australia/Sydney')).toBe('61');
  });

  it('falls back to the US/CA soft default for unknown or missing zones', () => {
    expect(defaultDialCode('America/New_York')).toBe('1');
    expect(defaultDialCode('Antarctica/Troll')).toBe('1');
    expect(defaultDialCode(undefined)).toBe('1');
  });
});

describe('countries', () => {
  it('resolves a stored number back to a country by longest dial-code match', () => {
    expect(countryForE164('+14155550142')?.code).toBe('US');
    expect(countryForE164('+919876543210')?.code).toBe('IN');
    expect(countryForE164('+442079460958')?.code).toBe('GB');
    // Shared codes resolve to the primary country, not whichever sorts first.
    expect(countryForE164('+77015550142')?.code).toBe('RU');
    expect(countryForE164('4155550142')).toBeUndefined();
  });

  it('maps ISO codes to dial codes, defaulting to +1', () => {
    expect(dialCodeFor('IN')).toBe('91');
    expect(dialCodeFor('in')).toBe('91');
    expect(dialCodeFor('ZZ')).toBe('1');
  });
});
