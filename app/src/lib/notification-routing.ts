import * as Notifications from 'expo-notifications';
import { useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';

/**
 * Tapping a reminder should land on the person it is about. The push payload has
 * carried `{ personId, reminderId }` since Stage 4 (see backend
 * `channels/push.ts`), but nothing ever read it, so every tap dropped the user
 * on whatever tab they left open - the reminder told them *someone* had a
 * birthday and then made them go find who.
 *
 * Both entry points are covered:
 *  - warm/background: `addNotificationResponseReceivedListener`
 *  - cold start: `getLastNotificationResponseAsync`, which replays the tap that
 *    launched the process (and would otherwise fire before any listener exists)
 *
 * Web has no push channel, so this hook no-ops there via `.web.ts`.
 */

function personIdOf(response: Notifications.NotificationResponse | null): string | null {
  const data = response?.notification.request.content.data as
    | { personId?: unknown }
    | undefined;
  return typeof data?.personId === 'string' && data.personId ? data.personId : null;
}

/**
 * @param enabled Only route once the session is resolved and the navigator is
 *                mounted - a cold-start tap otherwise races the auth redirect
 *                and gets replaced by `/(auth)/login` or `/(tabs)`.
 */
export function useNotificationRouting(enabled: boolean): void {
  const router = useRouter();
  // A cold-start response stays "last" forever, so replaying it on every
  // re-render (or on a later sign-in) would yank the user back to that person.
  const handled = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const open = (response: Notifications.NotificationResponse | null) => {
      const personId = personIdOf(response);
      if (!personId) return;
      const key = response!.notification.request.identifier;
      if (handled.current === key) return;
      handled.current = key;
      router.push(`/person/${personId}`);
    };

    void Notifications.getLastNotificationResponseAsync().then(open).catch(() => {
      // No launch notification, or the module is unavailable - nothing to route.
    });

    const sub = Notifications.addNotificationResponseReceivedListener(open);
    return () => sub.remove();
  }, [enabled, router]);
}
