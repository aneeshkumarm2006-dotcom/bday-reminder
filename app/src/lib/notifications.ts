import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { remindersApi } from './api';

/**
 * Expo push registration (TODO Stage 4; FR-23/54). Native-only and best-effort:
 * a simulator can't mint a token, a denied permission is not an error, and
 * there's no real EAS project wired yet, so any failure resolves to `null`
 * instead of throwing. Web has no push channel and uses `notifications.web.ts`,
 * so `expo-notifications` is never bundled there.
 *
 * Safe to call on every launch - the backend de-dups tokens (`$addToSet`).
 */

// Show reminders that arrive while the app is foregrounded.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

function resolveProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;
  try {
    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted
      ? true
      : (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return null;

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'Reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const projectId = resolveProjectId();
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await remindersApi.registerPushToken(token);
    return token;
  } catch {
    // Denied permission, missing EAS project, or offline - all non-fatal.
    return null;
  }
}

/** Best-effort unregister, e.g. on logout. Native-only; web is a no-op. */
export async function unregisterPushNotifications(token: string): Promise<void> {
  try {
    await remindersApi.unregisterPushToken(token);
  } catch {
    // Non-fatal.
  }
}
