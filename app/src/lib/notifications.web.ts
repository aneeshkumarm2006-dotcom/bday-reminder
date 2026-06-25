/**
 * Web has no push channel - the one allowed parity exception is the widget, but
 * push registration simply no-ops here (FR parity §5). Metro resolves this file
 * for web so `expo-notifications` is never bundled into the web build.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  return null;
}

export async function unregisterPushNotifications(_token: string): Promise<void> {
  // No-op on web.
}
