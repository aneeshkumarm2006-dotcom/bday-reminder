import { registerWidgetTaskHandler } from 'react-native-android-widget';

import { widgetTaskHandler } from './widget-task-handler';

/**
 * Android-only: register the widget background task handler at app-entry time
 * (TODO Stage 10; FR-49). Must run synchronously when the bundle loads - the OS
 * may start the JS bundle headlessly just to update a placed widget, and the
 * handler has to already be registered for that render to happen.
 */
registerWidgetTaskHandler(widgetTaskHandler);

export function registerWidget(): void {
  // Registration already happened as a module side-effect above; this exists
  // only so the import in `index.js` has a symbol to reference on every target.
}
