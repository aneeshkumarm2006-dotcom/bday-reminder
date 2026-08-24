import * as AppleAuthentication from 'expo-apple-authentication';
import { useState } from 'react';
import { View, useColorScheme } from 'react-native';

import { Text } from '@/components/ui';
import type { AppleSignInStatus } from '@/lib/apple-auth';

/**
 * "Sign in with Apple" button. Required by App Store Guideline 4.8: an app
 * offering a third-party social login (our "Continue with Google") must also
 * offer a privacy-preserving equivalent, and Apple's own is it.
 *
 * Presentational on purpose - `<AuthProviders>` decides whether this renders at
 * all (server provisioned + iOS 13+ hardware) and owns the shared "or" rule, so
 * the divider can't appear twice or hang under an empty block.
 *
 * Drawn with Apple's own `AppleAuthenticationButton` rather than our `Button`
 * because App Review requires their exact mark, wording and proportions.
 */
export function AppleSignInButton({
  mode = 'signIn',
  onSignIn,
}: {
  mode?: 'signIn' | 'signUp';
  onSignIn: () => Promise<AppleSignInStatus>;
}) {
  const scheme = useColorScheme();
  const [message, setMessage] = useState<string | null>(null);

  const press = async () => {
    setMessage(null);
    try {
      const status = await onSignIn();
      if (status === 'error' || status === 'unavailable') {
        setMessage("Couldn't sign you in with Apple. Please try again.");
      }
      // 'ok' → the auth guard redirects into the app; 'dismissed' → say nothing.
    } catch {
      setMessage("Couldn't sign you in with Apple. Please try again.");
    }
  };

  return (
    <View className="gap-2">
      <AppleAuthentication.AppleAuthenticationButton
        buttonType={
          mode === 'signUp'
            ? AppleAuthentication.AppleAuthenticationButtonType.SIGN_UP
            : AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN
        }
        // Apple requires the mark to stay legible against the surface behind it,
        // so the style follows the theme rather than being pinned to black.
        buttonStyle={
          scheme === 'dark'
            ? AppleAuthentication.AppleAuthenticationButtonStyle.WHITE
            : AppleAuthentication.AppleAuthenticationButtonStyle.BLACK
        }
        // Matches the app's control radius (DESIGN.md §3).
        cornerRadius={12}
        style={{ width: '100%', height: 48 }}
        onPress={press}
      />
      {message ? (
        <Text variant="caption" className="text-danger-fg">
          {message}
        </Text>
      ) : null}
    </View>
  );
}
