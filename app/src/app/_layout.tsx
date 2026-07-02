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
    </GestureHandlerRootView>
  );
}

/** File-based stack + the auth guard (login → the app). */
function RootNavigator() {
  const { status } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const tokens = useTokens();

  useEffect(() => {
    if (status === 'loading') return;
    // Session resolved - reveal the app.
    void SplashScreen.hideAsync();

    const inAuthGroup = segments[0] === '(auth)';
    if (status === 'unauthenticated' && !inAuthGroup) {
      router.replace('/(auth)/login');
    } else if (status === 'authenticated' && inAuthGroup) {
      // Signed in - drop straight into the app (no onboarding step) on the
      // Calendar home tab.
      router.replace('/(tabs)');
    }
  }, [status, segments, router]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: tokens.paper },
      }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
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
