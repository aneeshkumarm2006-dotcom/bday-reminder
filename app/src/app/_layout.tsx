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
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ConfirmProvider, ToastProvider } from '@/components/ui';
import { AuthProvider, useAuth } from '@/providers/auth-provider';
import { ThemeProvider, useThemePreference, useTokens } from '@/theme/theme-provider';

// Keep the splash up until fonts are ready and the session is resolved.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    HankenGrotesk_500Medium,
    HankenGrotesk_600SemiBold,
    Inter_400Regular,
    Inter_500Medium,
  });

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

  useEffect(() => {
    if (status === 'loading') return;
    // Session resolved - reveal the app.
    void SplashScreen.hideAsync();

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
  );
}

function ThemedStatusBar() {
  const { scheme } = useThemePreference();
  return <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />;
}
