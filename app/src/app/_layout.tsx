import '@/global.css';

import {
  HankenGrotesk_500Medium,
  HankenGrotesk_600SemiBold,
} from '@expo-google-fonts/hanken-grotesk';
import { Inter_400Regular, Inter_500Medium } from '@expo-google-fonts/inter';
import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LaunchScreen } from '@/components/launch-screen';
import { ConfirmProvider, ToastProvider } from '@/components/ui';
import { startAppIconSync } from '@/lib/app-icon';
import { useNotificationRouting } from '@/lib/notification-routing';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { ThemeProvider, useThemePreference, useTokens } from '@/theme/theme-provider';

/**
 * Launch is two screens pretending to be one:
 *
 *  1. the native splash - a static mark on paper, the only thing that can be on
 *     screen before React exists, and
 *  2. `<LaunchScreen>` - the same mark, animated, circling today's date.
 *
 * The native one is dismissed the moment the animated one has painted (see
 * `onLayout` below), so the seam never shows. It fades rather than cuts because
 * the two are pixel-near but not pixel-identical.
 */
void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 300, fade: true });

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
  });

  // Keep the launcher icon circling today's date for as long as the app lives.
  // Deliberately outside the auth tree: the icon is not personal data and a
  // signed-out user's phone should still show the right day.
  useEffect(() => startAppIconSync(), []);

  if (!fontsLoaded && !fontError) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Keyboard insets for the whole app: every form scrolls the focused
          field above the keyboard instead of leaving it hidden behind it
          (react-native-keyboard-controller, see components/ui/form-scroll-view). */}
      <KeyboardProvider>
        <SafeAreaProvider>
          <ThemeProvider>
            <AuthProvider>
              <ToastProvider>
                <ConfirmProvider>
                  <RootNavigator />
                  <ThemedStatusBar />
                </ConfirmProvider>
              </ToastProvider>
            </AuthProvider>
          </ThemeProvider>
        </SafeAreaProvider>
      </KeyboardProvider>
    </GestureHandlerRootView>
  );
}

/** File-based stack + the auth guard (login → the app). */
function RootNavigator() {
  const { status, user, needsBirthdayPrompt } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const tokens = useTokens();

  // The animated launch screen sits over the stack until it has both played out
  // AND the session has resolved, so it covers the auth redirect below rather
  // than letting the user watch login flash past on the way to the app. It owns
  // that wait itself (`ready`) so it can never be unmounted and replayed.
  const [launchDone, setLaunchDone] = useState(false);
  const onLaunchFinished = useCallback(() => setLaunchDone(true), []);
  const onLaunchPainted = useCallback(() => void SplashScreen.hideAsync(), []);

  // Tapping a reminder opens the person it is about (the push payload has always
  // carried `personId`). Gated on a resolved session so a cold-start tap is not
  // immediately replaced by the auth redirect below.
  useNotificationRouting(status === 'authenticated');

  useEffect(() => {
    if (status === 'loading') return;

    const inAuthGroup = segments[0] === '(auth)';
    // The Google sign-in deep-link return lands here still unauthenticated and
    // finishes the sign-in itself - don't yank it to login mid-handoff.
    const onGoogleReturn = (segments[0] as string) === 'google-login';
    if (status === 'unauthenticated' && !inAuthGroup && !onGoogleReturn) {
      router.replace('/(auth)/login');
    } else if (status === 'authenticated' && needsBirthdayPrompt && !user?.birthday) {
      // A Google sign-up that created the account: it never saw a form, so it
      // owes us the one thing the form would have asked for. Driven from here
      // rather than the button so both Google entry points - the in-app browser
      // session and the deep-link fallback - are covered by one rule.
      if ((segments[0] as string) !== 'welcome-birthday') router.replace('/welcome-birthday');
    } else if (status === 'authenticated' && inAuthGroup) {
      // Signed in - drop straight into the app (no onboarding step) on the
      // Calendar home tab.
      router.replace('/(tabs)');
    }
  }, [status, segments, router, needsBirthdayPrompt, user?.birthday]);

  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: tokens.paper },
        }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="google-login" />
        <Stack.Screen name="welcome-birthday" />
        <Stack.Screen name="google-import-connected" />
        <Stack.Screen name="gmail-connected" />
        <Stack.Screen name="add-person" options={{ presentation: 'modal' }} />
        <Stack.Screen name="import" options={{ presentation: 'modal' }} />
        <Stack.Screen name="person/[id]" />
        <Stack.Screen name="list/[id]" />
        <Stack.Screen name="calendar-sync" />
        <Stack.Screen name="invite/[token]" options={{ presentation: 'modal' }} />
      </Stack>

      {launchDone ? null : (
        <LaunchScreen
          ready={status !== 'loading'}
          onPainted={onLaunchPainted}
          onFinished={onLaunchFinished}
        />
      )}
    </View>
  );
}

function ThemedStatusBar() {
  const { scheme } = useThemePreference();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}
