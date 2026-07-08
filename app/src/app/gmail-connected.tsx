import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useTokens } from '@/theme/theme-provider';

/**
 * Deep-link landing for the Gmail auto-send connect return
 * (`circlethedate://gmail-connected?status=ok|error`).
 *
 * Normally `WebBrowser.openAuthSessionAsync` in gmail-auth.ts intercepts this
 * redirect and `connectGmail` resolves without a route ever opening. But on
 * Android the server-side 302 to the custom scheme is frequently dispatched as a
 * fresh Intent into the app instead of resolving that browser session, which
 * would otherwise dead-end on Expo Router's "Unmatched Route" screen (mirrors
 * google-login.tsx / google-import-connected.tsx). This route is the fallback:
 * it refreshes the user to pick up the new `gmailConnected` flag, then lands back
 * on Settings, where the Gmail connection state is shown. (Unlike the import
 * flow it can't resume the in-progress auto-send sheet, but Gmail is connected
 * account-wide, so the user just re-opens the toggle.)
 */
export default function GmailConnectedReturn() {
  const router = useRouter();
  const t = useTokens();
  const params = useLocalSearchParams<{ status?: string }>();
  const { status: authStatus, refreshUser } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    // On a cold start the deep link can arrive before the session rehydrates -
    // wait for auth to settle before hitting /me.
    if (authStatus === 'loading' || ran.current) return;
    ran.current = true;

    if (authStatus !== 'authenticated') {
      // No session (shouldn't happen from this flow) - send them to sign in.
      router.replace('/(auth)/login');
      return;
    }

    // Success or failure, land back on Settings (where the Gmail connection
    // lives); on ok, refresh first so the connected state shows immediately.
    if (params.status === 'ok') {
      void refreshUser().finally(() => router.replace('/(tabs)/settings'));
    } else {
      router.replace('/(tabs)/settings');
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
          Connecting Gmail…
        </Text>
      </View>
    </Screen>
  );
}
