/**
 * Web has no push channel (FR parity §5), so there is no notification tap to
 * route. Metro resolves this file for web so `expo-notifications` is never
 * bundled there.
 */
export function useNotificationRouting(_enabled: boolean): void {
  // No-op on web.
}
