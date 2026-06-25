/**
 * Widget task-handler registration (TODO Stage 10). Base/no-op target - Metro
 * swaps in `register.android.ts` on Android, where the handler is actually
 * registered. iOS WidgetKit has no JS task handler (its timeline lives in
 * Swift), and web has no widget, so both use this no-op. Imported once from the
 * app entry (`index.js`) so the handler is registered before any headless
 * background render runs.
 */
export function registerWidget(): void {
  // No-op on iOS / web.
}
