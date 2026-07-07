import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Screen, Text } from '@/components/ui';
import { useAuth } from '@/providers/auth-provider';
import { useTokens } from '@/theme/theme-provider';

/**
 * Deep-link landing for the "Sign in with Google" return
 * (`circlethedate://google-login?status=ok&handoff=…`).
 *
 * Normally `WebBrowser.openAuthSessionAsync` in google-auth.ts intercepts this
 * redirect and completes the sign-in without ever opening a route. But on
 * Android the server-side 302 to the custom scheme is frequently dispatched as a
 * fresh Intent into the app instead of resolving that browser session, which
 * would otherwise dead-end on Expo Router's "Unmatched Route" screen. This route
 * is the fallback: it reads the handoff and finishes the sign-in itself. The
 * handoff is single-use, so this and the browser-session path never both consume
 * one.
 */
export default function GoogleLoginReturn() {
  const router = useRouter();
  const t = useTokens();
  const params = useLocalSearchParams<{ status?: string; handoff?: string }>();
  const { status: authStatus, completeGoogleSession } = useAuth();
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // The in-app browser session already finished the sign-in - just proceed
    // (avoids re-spending the now-consumed handoff).
    if (authStatus === 'authenticated') {
      router.replace('/(tabs)');
      return;
    }

    const handoff = typeof params.handoff === 'string' ? params.handoff : '';
    if (params.status === 'ok' && handoff) {
      void completeGoogleSession(handoff).then((ok) => {
        router.replace(ok ? '/(tabs)' : '/(auth)/login');
      });
    } else {
      // 'unavailable' / 'error' / malformed - back to login to try again.
      router.replace('/(auth)/login');
    }
    // Run once on mount; params/auth are snapshotted at the initial navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Screen edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-1 items-center justify-center gap-4 px-6">
        <ActivityIndicator color={t.biro} />
        <Text variant="body" className="text-ink-secondary">
          Signing you in…
        </Text>
      </View>
    </Screen>
  );
}
