import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';

import { AppleSignInButton } from '@/components/apple-sign-in-button';
import { GoogleSignInButton } from '@/components/google-sign-in-button';
import { Text } from '@/components/ui';
import { configApi } from '@/lib/api';
import { isAppleSignInAvailable } from '@/lib/apple-auth';
import { useAuth } from '@/providers/auth-provider';

/**
 * The third-party sign-in block on the auth screens - one "or" rule, then every
 * provider this build and this server actually support.
 *
 * It owns the availability checks (rather than each button doing its own) for
 * two reasons: the divider must appear exactly once, and only when at least one
 * provider will render - otherwise the login screen grows a stray rule under the
 * password field on a server with neither provisioned.
 *
 * Ordering is not cosmetic. Apple's Human Interface Guidelines require the Sign
 * in with Apple button to sit above other sign-in options, and App Review does
 * check it - so Apple is rendered first, deliberately.
 *
 * Native only: the Expo web build has no Apple sheet, and the Google flow
 * returns via the circlethedate:// scheme a browser popup can't navigate. The
 * web surface with social login is the website, which runs its own flow.
 */

// Constant per bundle, so the hooks below still run unconditionally.
const IS_WEB = Platform.OS === 'web';
const IS_IOS = Platform.OS === 'ios';

export function AuthProviders({ mode = 'signIn' }: { mode?: 'signIn' | 'signUp' }) {
  const { signInWithApple, signInWithGoogle } = useAuth();
  const [showApple, setShowApple] = useState(false);
  const [showGoogle, setShowGoogle] = useState(false);

  useEffect(() => {
    if (IS_WEB) return;
    let active = true;
    (async () => {
      // Config unreachable → both stay hidden rather than offering a button that
      // would only error out.
      const config = await configApi.get().catch(() => null);
      if (!active || !config) return;
      setShowGoogle(!!config.googleAuthAvailable);
      // Apple needs the server provisioned AND hardware that can present the
      // sheet (iOS 13+), so the device check only runs if the server says yes.
      if (IS_IOS && config.appleAuthAvailable) {
        const supported = await isAppleSignInAvailable();
        if (active) setShowApple(supported);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  if (IS_WEB || (!showApple && !showGoogle)) return null;

  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-3" aria-hidden>
        <View className="h-[1px] flex-1 bg-border-subtle" />
        <Text variant="caption" className="text-ink-secondary">
          or
        </Text>
        <View className="h-[1px] flex-1 bg-border-subtle" />
      </View>
      {showApple ? <AppleSignInButton mode={mode} onSignIn={signInWithApple} /> : null}
      {showGoogle ? (
        <GoogleSignInButton
          label={mode === 'signUp' ? 'Sign up with Google' : 'Sign in with Google'}
          onSignIn={signInWithGoogle}
        />
      ) : null}
    </View>
  );
}
