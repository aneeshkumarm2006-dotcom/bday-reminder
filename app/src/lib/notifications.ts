import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import { remindersApi } from './api';

/**
 * Expo push registration (Stage 4; FR-23/54). Native-only and best-effort: a
 * simulator can't mint a token and a denied permission is not an error, so
 * failures resolve to `null`/`false` instead of throwing. Web has no push
 * channel and uses `notifications.web.ts`, so `expo-notifications` is never
 * bundled there.
 *
 * Safe to call on every launch - the backend de-dups tokens.
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

/**
 * The channel every reminder is delivered on. Named "default" to match the
 * `defaultChannel` in the expo-notifications plugin config (which writes
 * `com.google.firebase.messaging.default_notification_channel_id`), and quoted
 * back by the server as `channelId` on each push.
 *
 * Created at import time rather than after the permission prompt: Android will
 * silently drop a push whose channel does not exist yet, and a channel can be
 * created before - and independently of - the user granting POST_NOTIFICATIONS.
 * Importance HIGH so a birthday the user asked to be reminded about actually
 * heads-up instead of landing silently in the tray.
 */
const ANDROID_CHANNEL_ID = 'default';

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
      name: 'Reminders',
      importance: Notifications.AndroidImportance.HIGH,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.PRIVATE,
      sound: 'default',
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#2C4BD8',
    });
  } catch {
    // Channel creation is not worth failing a launch over.
  }
}

void ensureAndroidChannel();

function resolveProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined;
  return extra?.eas?.projectId;
}

/**
 * Whether this device can currently receive a push - i.e. the OS permission is
 * granted. Lets Settings tell the difference between "push is off in the app"
 * and "push is blocked by the system", which otherwise looks identical: the
 * toggle reads on and nothing ever arrives.
 */
export async function getPushPermissionStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  if (!Device.isDevice) return 'denied';
  try {
    const { granted, canAskAgain } = await Notifications.getPermissionsAsync();
    if (granted) return 'granted';
    return canAskAgain ? 'undetermined' : 'denied';
  } catch {
    return 'undetermined';
  }
}

/**
 * The token this device last handed to the server, so sign-out can take it back
 * without minting a fresh one (which would re-prompt and re-register).
 */
let lastRegisteredToken: string | null = null;

export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) return null;
  try {
    await ensureAndroidChannel();

    const current = await Notifications.getPermissionsAsync();
    const granted = current.granted
      ? true
      : (await Notifications.requestPermissionsAsync()).granted;
    if (!granted) return null;

    const projectId = resolveProjectId();
    const { data: token } = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    await remindersApi.registerPushToken(token);
    lastRegisteredToken = token;
    return token;
  } catch {
    // Denied permission, unconfigured FCM, or offline - all non-fatal here.
    // NOTE: a missing `android.googleServicesFile` lands in this catch and is
    // indistinguishable from a shrug, which is how 1.0.2 shipped with push
    // quietly dead. app.config.js now supplies it; see the comment there.
    return null;
  }
}

/**
 * Detach this device from the signed-in account. Without it the token stays on
 * the old user server-side, so after a sign-out - or a hand-off to a second
 * account on the same phone - the device keeps buzzing with the previous user's
 * birthdays. Best-effort and native-only; web is a no-op.
 */
export async function unregisterPushNotifications(token?: string): Promise<void> {
  const target = token ?? lastRegisteredToken;
  if (!target) return;
  try {
    await remindersApi.unregisterPushToken(target);
  } catch {
    // Offline sign-out: the token is pruned server-side on the next
    // DeviceNotRegistered ticket anyway.
  } finally {
    if (target === lastRegisteredToken) lastRegisteredToken = null;
  }
}
