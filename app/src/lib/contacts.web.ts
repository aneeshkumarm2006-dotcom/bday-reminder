import type { ContactImportResult } from './contacts';

/**
 * Web has no address book, so contact import isn't available here - the import
 * screen falls back to manual entry (FR-6). Metro resolves this file for
 * web, keeping `expo-contacts` out of the web bundle (the type-only import above
 * is erased at compile time).
 */
export async function importDeviceContacts(): Promise<ContactImportResult> {
  return { status: 'unsupported' };
}
