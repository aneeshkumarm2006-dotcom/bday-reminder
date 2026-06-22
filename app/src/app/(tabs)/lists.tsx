import { useFocusEffect, useRouter } from 'expo-router';
import { Plus, Users } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, ScrollView, View } from 'react-native';

import { MemberAvatars } from '@/components/member-avatars';
import {
  Button,
  Card,
  EmptyState,
  Pill,
  Screen,
  Sheet,
  Text,
  TextField,
  useToast,
} from '@/components/ui';
import { ApiError, listsApi, type SharedListView } from '@/lib/api';
import { useTokens } from '@/theme/theme-provider';

/**
 * Shared lists index (DESIGN.md §8.9/§8.10). Lists the user owns or belongs to,
 * each a tappable card with member avatars + counts. Empty state invites
 * creating the first list. "Create a list" opens a name sheet; an invite link
 * can be redeemed from here too (web has no deep links).
 */
export default function ListsScreen() {
  const router = useRouter();
  const toast = useToast();
  const t = useTokens();

  const [lists, setLists] = useState<SharedListView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setLists((await listsApi.list()).lists);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load your lists. Try again.");
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <Screen>
      <View className="flex-row items-center justify-between pb-2 pt-3">
        <Text variant="title">Lists</Text>
        {lists && lists.length > 0 ? (
          <Button variant="ghost" leftIcon={Plus} onPress={() => setCreateOpen(true)}>
            New list
          </Button>
        ) : null}
      </View>

      {lists === null && !error ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={t.biro} />
        </View>
      ) : error ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="body" className="text-center text-ink-secondary">
            {error}
          </Text>
          <Button variant="secondary" onPress={() => void load()}>
            Try again
          </Button>
        </View>
      ) : lists && lists.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No shared lists."
          body="Share a list with family so nobody tracks the same birthday twice.">
          <Button fullWidth onPress={() => setCreateOpen(true)}>
            Create a list
          </Button>
          <Button variant="ghost" fullWidth onPress={() => setJoinOpen(true)}>
            Have an invite link?
          </Button>
        </EmptyState>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
          <View className="gap-2">
            {lists?.map((list) => (
              <Card key={list.id} onPress={() => router.push(`/list/${list.id}`)}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-1 pr-3">
                    <View className="flex-row items-center gap-2">
                      <Text variant="cardName">{list.name}</Text>
                      {list.role === 'owner' ? <Pill label="Owner" /> : null}
                    </View>
                    <Text variant="caption" tabularNums className="mt-1 text-ink-secondary">
                      {memberLine(list.memberCount)} · {peopleLine(list.peopleCount)}
                    </Text>
                  </View>
                  <MemberAvatars members={list.members} />
                </View>
              </Card>
            ))}
          </View>

          <View className="mt-4 gap-2">
            <Button variant="ghost" fullWidth onPress={() => setJoinOpen(true)}>
              Have an invite link?
            </Button>
          </View>
        </ScrollView>
      )}

      <CreateListSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={(list) => {
          setCreateOpen(false);
          router.push(`/list/${list.id}`);
        }}
      />
      <JoinSheet
        visible={joinOpen}
        onClose={() => setJoinOpen(false)}
        onToken={(token) => {
          setJoinOpen(false);
          router.push(`/invite/${token}`);
        }}
        toastError={(m) => toast.show(m)}
      />
    </Screen>
  );
}

function memberLine(count: number): string {
  return count === 1 ? '1 member' : `${count} members`;
}
function peopleLine(count: number): string {
  if (count === 0) return 'no people yet';
  return count === 1 ? '1 person' : `${count} people`;
}

function CreateListSheet({
  visible,
  onClose,
  onCreated,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: (list: SharedListView) => void;
}) {
  const toast = useToast();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);

  const create = async () => {
    const value = name.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      const { list } = await listsApi.create(value);
      setName('');
      onCreated(list);
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : "Couldn't create the list. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Create a list">
      <TextField
        label="List name"
        value={name}
        onChangeText={setName}
        placeholder="e.g. Family"
        autoFocus
        returnKeyType="done"
        onSubmitEditing={() => void create()}
      />
      <View className="mt-4">
        <Button fullWidth loading={saving} disabled={!name.trim()} onPress={() => void create()}>
          Create list
        </Button>
      </View>
    </Sheet>
  );
}

function JoinSheet({
  visible,
  onClose,
  onToken,
  toastError,
}: {
  visible: boolean;
  onClose: () => void;
  onToken: (token: string) => void;
  toastError: (message: string) => void;
}) {
  const [value, setValue] = useState('');

  const go = () => {
    // Accept either a raw token or a full ".../invite/<token>" link.
    const trimmed = value.trim();
    const token = trimmed.split('/').filter(Boolean).pop() ?? '';
    if (!token) {
      toastError('Paste the invite link or code.');
      return;
    }
    setValue('');
    onToken(token);
  };

  return (
    <Sheet visible={visible} onClose={onClose} title="Join a list">
      <Text variant="caption" className="mb-2 text-ink-secondary">
        Paste the invite link or code someone shared with you.
      </Text>
      <TextField
        label="Invite link or code"
        value={value}
        onChangeText={setValue}
        placeholder="https://…/invite/…"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="go"
        onSubmitEditing={go}
      />
      <View className="mt-4">
        <Button fullWidth disabled={!value.trim()} onPress={go}>
          Continue
        </Button>
      </View>
    </Sheet>
  );
}
