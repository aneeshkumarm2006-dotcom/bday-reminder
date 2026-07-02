import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { Button, Text, type IconProps } from '@/components/ui';
import { configApi } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

/**
 * "Continue with Google" (identity login) for the auth screens - the app twin
 * of the website's GoogleAuthButton. Renders nothing until GET /config confirms
 * the server has Google login provisioned (config.googleAuthAvailable), so the
 * button never appears when it would just error out. Owns the whole flow:
 * divider, busy state while the browser session is open, and the inline
 * error/unavailable messages ('ok' redirects via the auth guard; a plain
 * dismiss says nothing).
 *
 * Note: signing in requests identity ONLY (name + email). The Gmail "send as
 * you" permission is a separate, later opt-in on the auto-send screens.
 *
 * Native only: the flow returns via the circlethedate:// scheme, which a
 * browser popup can't navigate, so on the Expo web build the button would
 * silently dead-end. The web surface with Google login is the website, whose
 * flow redirects through its own /auth/google page (platform=web).
 */

// Constant per bundle, so the hooks below still run unconditionally.
const IS_WEB = Platform.OS === 'web';

type Message = { kind: 'error' | 'note'; text: string };

export function GoogleSignInButton({ label = 'Continue with Google' }: { label?: string }) {
  const { signInWithGoogle } = useAuth();
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<Message | null>(null);

  useEffect(() => {
    if (IS_WEB) return;
    let active = true;
    configApi
      .get()
      .then((c) => {
        if (active) setAvailable(!!c.googleAuthAvailable);
      })
      .catch(() => {
        /* config unreachable → keep the button hidden */
      });
    return () => {
      active = false;
    };
  }, []);

  if (IS_WEB || !available) return null;

  const press = async () => {
    setMessage(null);
    setBusy(true);
    try {
      const status = await signInWithGoogle();
      if (status === 'error') {
        setMessage({ kind: 'error', text: "Couldn't sign you in with Google. Please try again." });
      } else if (status === 'unavailable') {
        setMessage({
          kind: 'note',
          text: "Google sign-in isn't available right now. Use your email and password.",
        });
      }
      // 'ok' → the auth guard redirects into the app; 'dismissed' → say nothing.
    } catch {
      setMessage({ kind: 'error', text: "Couldn't sign you in with Google. Please try again." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <View className="gap-4">
      <View className="flex-row items-center gap-3" aria-hidden>
        <View className="h-[1px] flex-1 bg-border-subtle" />
        <Text variant="caption" className="text-ink-secondary">
          or
        </Text>
        <View className="h-[1px] flex-1 bg-border-subtle" />
      </View>
      <Button
        variant="secondary"
        fullWidth
        loading={busy}
        // Not a Lucide icon, but it matches the piece of the LucideIcon call
        // signature Button uses (size); the stroke/color props are ignored.
        leftIcon={GoogleGlyph as unknown as IconProps['icon']}
        onPress={press}>
        {label}
      </Button>
      {message ? (
        <Text
          variant="caption"
          className={message.kind === 'error' ? 'text-danger-fg' : 'text-ink-secondary'}>
          {message.text}
        </Text>
      ) : null}
    </View>
  );
}

/** Google's four-colour "G" mark (brand colors, not themed ink). */
function GoogleGlyph({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <Path
        fill="#4285F4"
        d="M45.12 24.5c0-1.56-.14-3.06-.4-4.5H24v8.51h11.84c-.51 2.75-2.06 5.08-4.39 6.64v5.52h7.11c4.16-3.83 6.56-9.47 6.56-16.17z"
      />
      <Path
        fill="#34A853"
        d="M24 46c5.94 0 10.92-1.97 14.56-5.33l-7.11-5.52c-1.97 1.32-4.49 2.1-7.45 2.1-5.73 0-10.58-3.87-12.31-9.07H4.34v5.7C7.96 41.07 15.4 46 24 46z"
      />
      <Path
        fill="#FBBC05"
        d="M11.69 28.18c-.44-1.32-.69-2.73-.69-4.18s.25-2.86.69-4.18v-5.7H4.34C2.85 17.09 2 20.45 2 24s.85 6.91 2.34 9.88l7.35-5.7z"
      />
      <Path
        fill="#EA4335"
        d="M24 10.75c3.23 0 6.13 1.11 8.41 3.29l6.31-6.31C34.91 4.18 29.93 2 24 2 15.4 2 7.96 6.93 4.34 14.12l7.35 5.7c1.73-5.2 6.58-9.07 12.31-9.07z"
      />
    </Svg>
  );
}
