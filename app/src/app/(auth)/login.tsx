import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { DateRing } from '@/components/date-ring';
import { Button, Screen, Text, TextField } from '@/components/ui';
import { ApiError } from '@/lib/api';
import { monthAbbr, todayLocal } from '@/lib/dates';
import { useAuth } from '@/providers/auth-provider';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const today = todayLocal();

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      await signIn(email.trim(), password);
      // The auth guard redirects into the app once authenticated.
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "Couldn't reach the server. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
          keyboardShouldPersistTaps="handled">
          <View className="gap-8 py-8">
            {/* The signature ring on today's date doubles as the brand mark. */}
            <View className="items-center gap-3">
              <DateRing
                day={today.getDate()}
                month={monthAbbr(today.getMonth() + 1)}
                size="lg"
                state="today"
              />
              <Text variant="title" className="text-center">
                Circle the date
              </Text>
              <Text variant="body" className="max-w-[300px] text-center text-ink-secondary">
                Remember every birthday — and actually do something about it.
              </Text>
            </View>

            <View className="gap-4">
              <TextField
                label="Email"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                autoComplete="email"
                textContentType="emailAddress"
              />
              <TextField
                label="Password"
                value={password}
                onChangeText={setPassword}
                placeholder="Your password"
                secureTextEntry
                autoComplete="password"
                textContentType="password"
              />
              {error ? (
                <Text variant="caption" className="text-danger-fg">
                  {error}
                </Text>
              ) : null}
              <Button fullWidth loading={loading} onPress={submit}>
                Log in
              </Button>
            </View>

            <View className="flex-row items-center justify-center gap-1.5">
              <Text variant="body" className="text-ink-secondary">
                New here?
              </Text>
              <Pressable onPress={() => router.push('/(auth)/sign-up')} hitSlop={8}>
                <Text variant="body" className="text-biro">
                  Create an account
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
