import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useTokens } from '@/theme/theme-provider';

/**
 * Deep-link landing for the Google Calendar + Contacts import return
 * (`circlethedate://google-import-connected?status=ok|error`).
 *
 * Normally `WebBrowser.openAuthSessionAsync` in google-import-auth.ts intercepts
 * this redirect and `connectGoogleImport` resolves without a route ever opening.
 * But on Android the server-side 302 to the custom scheme is frequently
 * dispatched as a fresh Intent into the app instead of resolving that browser
 * session, which would otherwise dead-end on Expo Router's "Unmatched Route"
 * screen (mirrors google-login.tsx). This route is the fallback: it refreshes
 * the user to pick up the new `googleImportConnected` flag, then hands back to
 * the import screen, which auto-starts the Google preview.
 */
export default function GoogleImportReturn() {
  const router = useRouter();
  const t = useTokens();
  const params = useLocalSearchParams<{ status?: string }>();
  const { status: authStatus, refreshUser } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    // On a cold start the deep link can arrive before the session rehydrates -
    // wait for auth to settle before hitting /me or the import screen.
    if (authStatus === 'loading' || ran.current) return;
    ran.current = true;

    if (authStatus !== 'authenticated') {
      // No session (shouldn't happen from this flow) - send them to sign in.
      router.replace('/(auth)/login');
      return;
    }

    if (params.status === 'ok') {
      // Pick up the new googleImportConnected flag, then continue the import.
      // refreshUser swallows its own errors; either way we hand back to /import,
      // which re-requests consent if the flag somehow didn't land.
      void refreshUser().finally(() => {
        router.replace({ pathname: '/import', params: { source: 'google' } });
      });
    } else {
      router.replace({ pathname: '/import', params: { source: 'google-error' } });
    }
    // Re-run only when auth finishes loading; params are snapshotted at mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authStatus]);

  return (
    <Screen edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <ActivityIndicator color={t.biro} />
        <Text variant="body" className="text-ink-secondary">
          Connecting Google…
        </Text>
      </View>
    </Screen>
  );
}
