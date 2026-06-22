import * as Contacts from 'expo-contacts';

import type { ImportCandidate } from './api';

/**
 * Device contact import (TODO Stage 7; FR-6/10). Native-only: reads the address
 * book (with permission) and turns every contact that HAS a birthday field into
 * an import candidate; contacts without a birthday are skipped (FR-6). The
 * structured candidates go to `POST /import/preview`, which flags duplicates
 * before anything is created.
 *
 * Web has no address book, so `contacts.web.ts` resolves instead with an
 * `unsupported` result and `expo-contacts` is never bundled there (the same
 * platform-split pattern as `notifications`). The web import screen falls back
 * to CSV / manual entry.
 */

export type ContactImportResult =
  | { status: 'ok'; candidates: ImportCandidate[]; scanned: number }
  | { status: 'denied' }
  | { status: 'unsupported' }
  | { status: 'error'; message: string };

export async function importDeviceContacts(): Promise<ContactImportResult> {
  try {
    const permission = await Contacts.requestPermissionsAsync();
    if (!permission.granted) return { status: 'denied' };

    // SDK 56's contacts API: fetch just the fields we need across all contacts.
    const fields = [
      Contacts.ContactField.GIVEN_NAME,
      Contacts.ContactField.FAMILY_NAME,
      Contacts.ContactField.FULL_NAME,
      Contacts.ContactField.BIRTHDAY,
      Contacts.ContactField.PHONES,
    ] as const;
    const details = await Contacts.Contact.getAllDetails(fields);

    const candidates: ImportCandidate[] = [];
    for (const c of details) {
      const birthday = c.birthday;
      // Only import contacts that actually have a birthday on file (FR-6).
      if (!birthday || !birthday.month || !birthday.day) continue;

      const name = (c.fullName ?? [c.givenName, c.familyName].filter(Boolean).join(' ')).trim();
      if (!name) continue;

      const phone = c.phones?.find((p) => p.number)?.number ?? null;
      candidates.push({
        name,
        phone,
        // Year is optional on a contact birthday — keep it omitted (FR-14).
        dob: { month: birthday.month, day: birthday.day, year: birthday.year ?? null },
      });
    }

    return { status: 'ok', candidates, scanned: details.length };
  } catch {
    return { status: 'error', message: "Couldn't read your contacts. Try again." };
  }
}
