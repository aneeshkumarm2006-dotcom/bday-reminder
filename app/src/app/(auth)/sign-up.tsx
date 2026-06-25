import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';

import { Button, Screen, Text, TextField } from '@/components/ui';
import { cn, focusRing } from '@/lib/cn';
import { ApiError } from '@/lib/api';
import { useAuth } from '@/providers/auth-provider';

export default function SignUpScreen() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    if (name.trim().length === 0) return setError('Add your name so reminders can greet you.');
    if (password.length < 8) return setError('Use a password of at least 8 characters.');
    setLoading(true);
    try {
      await signUp({ name: name.trim(), email: email.trim(), password });
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
            <View className="gap-2">
              <Text variant="title">Create your account</Text>
              <Text variant="body" className="text-ink-secondary">
                One account, synced across your phone and the web.
              </Text>
            </View>

            <View className="gap-4">
              <TextField
                label="Name"
                value={name}
                onChangeText={setName}
                placeholder="Your name"
                autoCapitalize="words"
                autoComplete="name"
                textContentType="name"
              />
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
                placeholder="At least 8 characters"
                secureToggle
                autoComplete="password-new"
                textContentType="newPassword"
                hint="At least 8 characters."
              />
              {error ? (
                <Text variant="caption" className="text-danger-fg">
                  {error}
                </Text>
              ) : null}
              <Button fullWidth loading={loading} onPress={submit}>
                Create account
              </Button>
            </View>

            <View className="flex-row items-center justify-center gap-1.5">
              <Text variant="body" className="text-ink-secondary">
                Already have an account?
              </Text>
              <Pressable
                onPress={() => router.replace('/(auth)/login')}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Log in"
                className={cn('rounded-sm', focusRing)}>
                <Text variant="body" className="text-biro">
                  Log in
                </Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}
