import { ExtensionStorage } from '@bacons/apple-targets';

import { type UpcomingItem } from './api';
import { buildWidgetPayload, WIDGET_APP_GROUP, WIDGET_STORAGE_KEY } from './widget-data';

/**
 * iOS widget bridge (TODO Stage 10; FR-48/49). Writes the next-3 payload into a
 * shared **App Group** so the WidgetKit extension (`targets/widget/index.swift`)
 * can read it, then asks WidgetKit to reload its timelines. The Swift provider
 * recomputes "days remaining" from the stored absolute dates on each timeline
 * entry, so the countdown ticks down daily without the app open (FR-49).
 *
 * Best-effort: a failure here (e.g. the App Group not yet provisioned in a dev
 * build) must never break the feed, so everything is wrapped + swallowed.
 */

const storage = new ExtensionStorage(WIDGET_APP_GROUP);

export { buildWidgetPayload, type WidgetEvent, type WidgetPayload } from './widget-data';

export async function syncWidget(items: UpcomingItem[]): Promise<void> {
  try {
    const payload = buildWidgetPayload(items);
    storage.set(WIDGET_STORAGE_KEY, JSON.stringify(payload));
    ExtensionStorage.reloadWidget();
  } catch {
    // Non-fatal — the widget just keeps its previous content.
  }
}

export async function clearWidget(): Promise<void> {
  try {
    storage.remove(WIDGET_STORAGE_KEY);
    ExtensionStorage.reloadWidget();
  } catch {
    // Non-fatal.
  }
}
