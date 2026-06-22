/**
 * Web has no home-screen widget — the one allowed parity exception (PRD §5).
 * Metro resolves this file for web so neither native widget library is ever
 * bundled into the web build. Both calls no-op.
 */
import { type UpcomingItem } from './api';

export { buildWidgetPayload, type WidgetEvent, type WidgetPayload } from './widget-data';

export async function syncWidget(_items: UpcomingItem[]): Promise<void> {
  // No-op on web.
}

export async function clearWidget(): Promise<void> {
  // No-op on web.
}
