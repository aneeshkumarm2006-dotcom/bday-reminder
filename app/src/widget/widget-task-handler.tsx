import AsyncStorage from '@react-native-async-storage/async-storage';
import { type WidgetTaskHandlerProps } from 'react-native-android-widget';

import { buildWidgetPayload, WIDGET_STORAGE_KEY, type WidgetPayload } from '@/lib/widget-data';

import { renderBirthdaysWidget } from './birthdays-widget';

/**
 * Android widget background task (TODO Stage 10; FR-49). The OS invokes this -
 * including headlessly, when the app isn't open - on add / periodic update /
 * resize. It reads the cached payload the app last wrote and re-renders, which
 * recomputes "days remaining" from the absolute dates, so the countdown stays
 * correct as days pass without the user opening the app.
 *
 * Clicks (`OPEN_URI` per row → a person's profile, `OPEN_APP` elsewhere) are
 * dispatched natively by the library, so there's nothing to do for WIDGET_CLICK.
 */

async function loadPayload(): Promise<WidgetPayload> {
  try {
    const raw = await AsyncStorage.getItem(WIDGET_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as WidgetPayload;
  } catch {
    // Corrupt/missing cache - fall through to an empty payload.
  }
  return buildWidgetPayload([]);
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(renderBirthdaysWidget(await loadPayload()));
      break;
    case 'WIDGET_CLICK':
    case 'WIDGET_DELETED':
    default:
      break;
  }
}
