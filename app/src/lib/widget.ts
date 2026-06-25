/**
 * Home-screen widget bridge (TODO Stage 10; FR-48/49). Pushes the "next 3
 * events" cache to the native widget. This is the typed default + safe no-op;
 * Metro swaps in the per-platform implementation at bundle time:
 *   · `widget.ios.ts`     → WidgetKit via an App Group (`@bacons/apple-targets`)
 *   · `widget.android.ts` → App Widget via `react-native-android-widget`
 *   · `widget.web.ts`     → no-op (web has no home screen - the one parity
 *                            exception, PRD §5)
 *
 * Callers import from `@/lib/widget`; the platform file actually runs. The
 * widget is mobile-only, so this base module is never the one executing on a
 * real device - it just gives TypeScript a single, consistent signature.
 */

import { type UpcomingItem } from './api';

export { buildWidgetPayload, type WidgetEvent, type WidgetPayload } from './widget-data';

/** Refresh the on-device widget cache from the latest Upcoming feed. */
export async function syncWidget(_items: UpcomingItem[]): Promise<void> {
  // No-op on the base/web target.
}

/** Clear the widget (e.g. on logout) so it never shows a signed-out user's data. */
export async function clearWidget(): Promise<void> {
  // No-op on the base/web target.
}
