import { cookies } from "next/headers";

import { EDITOR_COOKIE, normalizeEditorName } from "./editor";

/**
 * Server-only reader for the editor display-name cookie (see `editor.ts` for
 * why it exists and why it is *not* an auth signal). Split from the constants
 * so client components can import the cookie name without pulling in
 * `next/headers`.
 */
export async function getEditorName(): Promise<string> {
  try {
    const store = await cookies();
    return normalizeEditorName(store.get(EDITOR_COOKIE)?.value) || "Unknown";
  } catch {
    return "Unknown";
  }
}
