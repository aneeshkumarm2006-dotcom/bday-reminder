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

  const status = typeof params.status === 'string' ? params.status : '';
  const handoff = typeof params.handoff === 'string' ? params.handoff : '';

  useEffect(() => {
    if (ran.current) return;

    // The in-app browser session already finished the sign-in - just proceed
    // (avoids re-spending the now-consumed handoff).
    if (authStatus === 'authenticated') {
      ran.current = true;
      router.replace('/(tabs)');
      return;
    }

    if (status === 'ok' && handoff) {
      ran.current = true;
      void completeGoogleSession(handoff).then((ok) => {
        router.replace(ok ? '/(tabs)' : '/(auth)/login');
      });
      return;
    }

    // A cold-start deep link can mount this route a render before expo-router
    // has parsed the query string, so an empty `status` is "not yet", NOT a
    // failure - bailing to /login here silently killed the sign-in. Only give
    // up once the params really did arrive and say something other than ok.
    if (status) {
      ran.current = true;
      // 'unavailable' / 'error' / malformed - back to login to try again.
      router.replace('/(auth)/login');
    }
  }, [status, handoff, authStatus, completeGoogleSession, router]);

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
