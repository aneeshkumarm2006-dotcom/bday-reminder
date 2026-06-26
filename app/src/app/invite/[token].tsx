import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Users } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Button, Screen, Text } from '@/components/ui';
import { ApiError, invitesApi, type InvitePreview } from '@/lib/api';
import { useTokens } from '@/theme/theme-provider';

/**
 * Invite acceptance (DESIGN.md §8.9; FR-42). Reached from an invite link
 * (`/invite/<token>`) or by pasting a code on the Lists screen. Membership is
 * never automatic - the user sees who invited them and to what, then explicitly
 * accepts before gaining access.
 */
export default function InviteScreen() {
  const router = useRouter();
  const t = useTokens();
  const { token } = useLocalSearchParams<{ token: string }>();

  const [preview, setPreview] = useState<InvitePreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (!token) return;
    let active = true;
    (async () => {
      try {
        const res = await invitesApi.preview(token);
        if (active) setPreview(res.invite);
      } catch (e) {
        if (active)
          setError(
            e instanceof ApiError ? e.message : "That invite link didn't work. Ask for a new one.",
          );
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [token]);

  const accept = async () => {
    if (!token || accepting) return;
    setAccepting(true);
    try {
      const { list } = await invitesApi.accept(token);
      router.replace(`/list/${list.id}`);
    } catch (e) {
      setAccepting(false);
      setError(e instanceof ApiError ? e.message : "Couldn't accept the invite. Try again.");
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
      <View className="flex-1 items-center justify-center px-6">
        {loading ? (
          <ActivityIndicator color={t.biro} />
        ) : error ? (
          <View className="items-center gap-4">
            <Text variant="heading" className="text-center">
              {error}
            </Text>
            <Button variant="secondary" onPress={() => router.replace('/lists')}>
              Go to Lists
            </Button>
          </View>
        ) : preview ? (
          <View className="w-full max-w-[360px] items-center">
            <View className="mb-4 h-14 w-14 items-center justify-center rounded-full bg-surface-sunken">
              <Users color={t.inkMuted} size={24} strokeWidth={1.75} />
            </View>
            <Text variant="heading" className="text-center">
              {preview.inviterName} invited you to “{preview.listName}”
            </Text>
            <Text variant="body" className="mt-2 text-center text-ink-secondary">
              You’ll see everyone in this list and can add and edit them, with your own reminder
              settings.
            </Text>

            <View className="mt-6 w-full gap-2">
              {preview.alreadyMember ? (
                <>
                  <Text variant="caption" className="text-center text-ink-muted">
                    You’re already in this list.
                  </Text>
                  <Button fullWidth loading={accepting} onPress={accept}>
                    Open list
                  </Button>
                </>
              ) : (
                <Button fullWidth loading={accepting} onPress={accept}>
                  Accept invite
                </Button>
              )}
              <Button variant="ghost" fullWidth onPress={() => router.replace('/lists')}>
                Not now
              </Button>
            </View>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}
