import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { ListCatchUp } from '@/components/list-catch-up';
import { Screen } from '@/components/ui';
import { listsApi } from '@/lib/api';

/**
 * Revisit the catch-up for a list you're already in (DESIGN.md §8.9). The same
 * screen runs inline right after accepting an invite; this route is how you get
 * back to it later from the list itself.
 *
 * A flat `catch-up/[listId]` rather than `list/[id]/catch-up`, because
 * expo-router can't host `list/[id].tsx` and a `list/[id]/` directory together.
 */
export default function CatchUpScreen() {
  const router = useRouter();
  const { listId } = useLocalSearchParams<{ listId: string }>();
  const [listName, setListName] = useState<string | null>(null);

  useEffect(() => {
    if (!listId) return;
    let active = true;
    listsApi
      .get(listId)
      .then((res) => {
        if (active) setListName(res.list.name);
      })
      .catch(() => {
        if (active) router.replace('/lists');
      });
    return () => {
      active = false;
    };
  }, [listId, router]);

  return (
    <Screen edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false, presentation: 'modal' }} />
      {listName ? (
        <ListCatchUp
          listId={listId}
          listName={listName}
          onDone={() => router.replace(`/list/${listId}`)}
        />
      ) : (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator />
        </View>
      )}
    </Screen>
  );
}
