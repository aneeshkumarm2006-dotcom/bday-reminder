import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { peekPendingReturn } from '@/lib/pending-return';
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
 * it refreshes the user to pick up the new `gmailConnected` flag, then hands
 * back to whichever screen parked itself before starting the connect (see
 * lib/pending-return.ts) with `resume=1`, so a half-filled add-person form and
 * its open auto-send sheet come back intact instead of being dumped on Settings.
 * Settings is only the fallback when nothing was parked (e.g. the connect was
 * started from Settings itself).
 */
export default function GmailConnectedReturn() {
  const router = useRouter();
  const t = useTokens();
  const params = useLocalSearchParams<{ status?: string }>();
  const { status: authStatus, refreshUser } = useAuth();
  const ran = useRef(false);

  // Land back on the screen that started the connect, flagged so it restores its
  // parked draft. Only peeked here - the screen itself consumes the record.
  const goBackToCaller = async (gmail: 'ok' | 'error') => {
    const parked = await peekPendingReturn();
    if (parked?.pathname === '/person/[id]' && parked.params?.id) {
      router.replace({
        pathname: '/person/[id]',
        params: { id: parked.params.id, resume: '1', gmail },
      });
      return;
    }
    if (parked?.pathname === '/add-person') {
      router.replace({
        pathname: '/add-person',
        params: { ...(parked.params ?? {}), resume: '1', gmail },
      });
      return;
    }
    router.replace('/(tabs)/settings');
  };

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

    // Success or failure, hand back to whatever the user was doing; on ok,
    // refresh first so the sheet reopens already showing Gmail as connected.
    const gmail = params.status === 'ok' ? 'ok' : 'error';
    if (params.status === 'ok') {
      void refreshUser().finally(() => void goBackToCaller(gmail));
    } else {
      void goBackToCaller(gmail);
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
