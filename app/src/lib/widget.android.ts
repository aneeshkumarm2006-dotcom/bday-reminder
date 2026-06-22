import AsyncStorage from '@react-native-async-storage/async-storage';
import { requestWidgetUpdate } from 'react-native-android-widget';

import { type UpcomingItem } from './api';
import { buildWidgetPayload, WIDGET_NAME, WIDGET_STORAGE_KEY } from './widget-data';
import { renderBirthdaysWidget } from '../widget/birthdays-widget';

/**
 * Android widget bridge (TODO Stage 10; FR-48/49). Caches the next-3 payload to
 * AsyncStorage — the same store the background task handler reads — then asks
 * any placed widget to re-render immediately so a just-added/edited person shows
 * without waiting for the periodic update. Between app opens, the OS triggers
 * the task handler on its update period to keep the countdown current (FR-49).
 *
 * Best-effort: a failure must never break the feed, so it's wrapped + swallowed.
 */

async function pushUpdate(items: UpcomingItem[]): Promise<void> {
  const payload = buildWidgetPayload(items);
  await AsyncStorage.setItem(WIDGET_STORAGE_KEY, JSON.stringify(payload));
  await requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: () => renderBirthdaysWidget(payload),
    // No widget on the home screen yet — nothing to render, not an error.
    widgetNotFound: () => {},
  });
}

export { buildWidgetPayload, type WidgetEvent, type WidgetPayload } from './widget-data';

export async function syncWidget(items: UpcomingItem[]): Promise<void> {
  try {
    await pushUpdate(items);
  } catch {
    // Non-fatal — the widget keeps its previous content.
  }
}

export async function clearWidget(): Promise<void> {
  try {
    await pushUpdate([]);
  } catch {
    // Non-fatal.
  }
}
