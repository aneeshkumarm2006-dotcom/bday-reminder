/**
 * Best-effort copy-to-clipboard without a native dependency. Uses the Web
 * Clipboard API where available (the app's web build, the primary place an
 * invite link is shared) and reports success so callers can fall back to a
 * "long-press to copy" hint on native, where the link is rendered selectable.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    const nav = typeof navigator !== 'undefined' ? navigator : undefined;
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Fall through — caller shows the manual-copy hint.
  }
  return false;
}
