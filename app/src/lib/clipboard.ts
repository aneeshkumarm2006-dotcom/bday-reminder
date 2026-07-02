import * as Clipboard from 'expo-clipboard';

/**
 * Copy text to the clipboard. Prefers the Web Clipboard API on web (works in
 * secure contexts without a permission prompt) and expo-clipboard on native.
 * Reports success so callers can fall back to a "long-press to copy" hint.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
    return await Clipboard.setStringAsync(text);
  } catch {
    // Fall through - caller shows the manual-copy hint.
  }
  return false;
}
