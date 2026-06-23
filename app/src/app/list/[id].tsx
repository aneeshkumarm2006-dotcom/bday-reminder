import { Stack, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, Copy, Trash2, UserPlus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { initials, MemberAvatars } from '@/components/member-avatars';
import {
  Button,
  Card,
  Chip,
  Icon,
  Pill,
  Screen,
  Select,
  Sheet,
  Text,
  TextField,
  useConfirm,
  useToast,
} from '@/components/ui';
import { cn, focusRing } from '@/lib/cn';
import {
  ApiError,
  listsApi,
  peopleApi,
  type CreatedInvite,
  type ListMember,
  type ListPermission,
  type PendingInvite,
  type PersonListItem,
  type SharedListView,
} from '@/lib/api';
import { copyText } from '@/lib/clipboard';
import { useTokens } from '@/theme/theme-provider';

/**
 * Shared list detail (DESIGN.md §8.9). Header with member avatars + Invite;
 * member rows with permission badges (the owner can change a member's permission
 * and remove them); pending invites until accepted; the people shared in the
 * list; and destructive leave/delete confirms with plain consequence copy (§10).
 */
export default function ListDetailScreen() {
  const router = useRouter();
  const t = useTokens();
  const toast = useToast();
  const confirm = useConfirm();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [list, setList] = useState<SharedListView | null>(null);
  const [people, setPeople] = useState<PersonListItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [leaving, setLeaving] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const [{ list: l }, { people: all }] = await Promise.all([
        listsApi.get(id),
        peopleApi.list(),
      ]);
      setList(l);
      setPeople(all.filter((p) => p.lists.includes(id)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Couldn't load this list. Try again.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const isOwner = list?.role === 'owner';

  const onLeave = async () => {
    if (!list) return;
    const ok = await confirm({
      title: `Leave ${list.name}?`,
      message: "You'll stop seeing this list's people and getting their reminders. You can be invited back later.",
      confirmLabel: 'Leave',
      destructive: true,
    });
    if (!ok) return;
    setLeaving(true);
    try {
      await listsApi.leave(list.id);
      toast.show('You left the list.');
      router.back();
    } catch (e) {
      setLeaving(false);
      toast.show(e instanceof ApiError ? e.message : "Couldn't leave the list. Try again.");
    }
  };

  const onDelete = async () => {
    if (!list) return;
    const ok = await confirm({
      title: `Delete ${list.name}?`,
      message: 'This deletes the list for everyone — all members lose access and their reminders for it stop. The people themselves stay in your own list. This can’t be undone.',
      confirmLabel: 'Delete list',
      destructive: true,
    });
    if (!ok) return;
    setLeaving(true);
    try {
      await listsApi.remove(list.id);
      toast.show('List deleted.');
      router.back();
    } catch (e) {
      setLeaving(false);
      toast.show(e instanceof ApiError ? e.message : "Couldn't delete the list. Try again.");
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <View className="flex-row items-center gap-2 pb-2 pt-3">
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className={cn('rounded-full', focusRing)}>
          <Icon icon={ChevronLeft} size={24} />
        </Pressable>
        <Text variant="title" className="flex-1" numberOfLines={1}>
          {list?.name ?? 'List'}
        </Text>
        {isOwner ? (
          <Button variant="ghost" leftIcon={UserPlus} onPress={() => setInviteOpen(true)}>
            Invite
          </Button>
        ) : null}
      </View>

      {loading && !list ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator color={t.biro} />
        </View>
      ) : error && !list ? (
        <View className="flex-1 items-center justify-center gap-4 px-6">
          <Text variant="body" className="text-center text-ink-secondary">
            {error}
          </Text>
          <Button variant="secondary" onPress={() => void load()}>
            Try again
          </Button>
        </View>
      ) : list ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
          <View className="flex-row items-center gap-3 pb-1 pt-1">
            <MemberAvatars members={list.members} />
            <Text variant="caption" tabularNums className="text-ink-secondary">
              {list.memberCount === 1 ? '1 member' : `${list.memberCount} members`}
            </Text>
          </View>

          {/* Members (§8.9) */}
          <Text variant="label" className="mb-2 mt-6 text-ink-muted">
            Members
          </Text>
          <Card>
            {list.members.map((member, i) => (
              <MemberRow
                key={member.id}
                member={member}
                isOwnerViewing={!!isOwner}
                divider={i > 0}
                onChangePermission={async (permission) => {
                  try {
                    const { list: updated } = await listsApi.setPermission(list.id, member.id, permission);
                    setList(updated);
                  } catch (e) {
                    toast.show(e instanceof ApiError ? e.message : "Couldn't update access. Try again.");
                  }
                }}
                onRemove={async () => {
                  const ok = await confirm({
                    title: `Remove ${member.name}?`,
                    message: `${member.name} will lose access to this list and stop getting its reminders.`,
                    confirmLabel: 'Remove',
                    destructive: true,
                  });
                  if (!ok) return;
                  try {
                    const { list: updated } = await listsApi.removeMember(list.id, member.id);
                    setList(updated);
                    toast.show(`Removed ${member.name}.`);
                  } catch (e) {
                    toast.show(e instanceof ApiError ? e.message : "Couldn't remove them. Try again.");
                  }
                }}
              />
            ))}
          </Card>

          {/* Pending invites (owner only, §8.9) */}
          {isOwner && list.pendingInvites.length > 0 ? (
            <>
              <Text variant="label" className="mb-2 mt-6 text-ink-muted">
                Pending invites
              </Text>
              <Card>
                {list.pendingInvites.map((invite, i) => (
                  <InviteRow
                    key={invite.id}
                    invite={invite}
                    divider={i > 0}
                    onRevoke={async () => {
                      try {
                        await listsApi.revokeInvite(list.id, invite.id);
                        setList({
                          ...list,
                          pendingInvites: list.pendingInvites.filter((p) => p.id !== invite.id),
                        });
                      } catch (e) {
                        toast.show(e instanceof ApiError ? e.message : "Couldn't revoke it. Try again.");
                      }
                    }}
                  />
                ))}
              </Card>
            </>
          ) : null}

          {/* People shared in this list */}
          <Text variant="label" className="mb-2 mt-6 text-ink-muted">
            People
          </Text>
          {people.length > 0 ? (
            <Card>
              {people.map((person, i) => (
                <Pressable
                  key={person.id}
                  onPress={() => router.push(`/person/${person.id}`)}
                  accessibilityRole="button"
                  accessibilityLabel={person.fullName}
                  className={cn(
                    'flex-row items-center justify-between rounded-sm active:opacity-70',
                    focusRing,
                    i > 0 && 'mt-3 border-t border-border-subtle pt-3',
                  )}>
                  <View className="flex-1 pr-2">
                    <Text variant="cardName">{person.fullName}</Text>
                    {person.relationshipTag ? (
                      <Text variant="caption" className="mt-0.5 text-ink-secondary">
                        {person.relationshipTag}
                      </Text>
                    ) : null}
                  </View>
                  <Icon icon={ChevronRight} size={20} color={t.inkMuted} />
                </Pressable>
              ))}
            </Card>
          ) : (
            <Text variant="caption" className="text-ink-muted">
              No people yet. Add someone to this list from “Add person”.
            </Text>
          )}

          {/* Destructive actions (§8.9, §10) */}
          <View className="mt-8">
            {isOwner ? (
              <Button variant="destructive" leftIcon={Trash2} fullWidth loading={leaving} onPress={onDelete}>
                Delete list
              </Button>
            ) : (
              <Button variant="destructive" leftIcon={Trash2} fullWidth loading={leaving} onPress={onLeave}>
                Leave list
              </Button>
            )}
          </View>
        </ScrollView>
      ) : null}

      {list ? (
        <InviteSheet
          visible={inviteOpen}
          listId={list.id}
          onClose={() => setInviteOpen(false)}
          onInvited={() => void load()}
        />
      ) : null}
    </Screen>
  );
}

const PERMISSION_LABEL: Record<string, string> = {
  owner: 'Owner',
  edit: 'Can edit',
  view: 'View only',
};

function MemberRow({
  member,
  isOwnerViewing,
  divider,
  onChangePermission,
  onRemove,
}: {
  member: ListMember;
  isOwnerViewing: boolean;
  divider: boolean;
  onChangePermission: (permission: ListPermission) => void;
  onRemove: () => void;
}) {
  const t = useTokens();
  const canManage = isOwnerViewing && !member.isOwner;

  return (
    <View className={divider ? 'mt-3 border-t border-border-subtle pt-3' : undefined}>
      <View className="flex-row items-center gap-3">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-surface-sunken">
          <Text variant="caption" className="text-ink-secondary">
            {initials(member.name)}
          </Text>
        </View>
        <View className="flex-1">
          <Text variant="cardName">{member.name}</Text>
          <Text variant="caption" className="mt-0.5 text-ink-muted" numberOfLines={1}>
            {member.email}
          </Text>
        </View>
        {member.isOwner ? (
          <Pill label="Owner" />
        ) : canManage ? (
          <View className="flex-row items-center gap-2">
            <View className="w-[132px]">
              <Select
                value={member.permission}
                options={[
                  { label: 'View only', value: 'view' },
                  { label: 'Can edit', value: 'edit' },
                ]}
                onChange={(v) => onChangePermission(v as ListPermission)}
              />
            </View>
            <Pressable
              onPress={onRemove}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`Remove ${member.name}`}
              className={cn('rounded-full active:scale-90', focusRing)}>
              <Icon icon={Trash2} size={18} color={t.inkMuted} />
            </Pressable>
          </View>
        ) : (
          <Pill label={PERMISSION_LABEL[member.permission] ?? 'Member'} />
        )}
      </View>
    </View>
  );
}

function InviteRow({
  invite,
  divider,
  onRevoke,
}: {
  invite: PendingInvite;
  divider: boolean;
  onRevoke: () => void;
}) {
  const t = useTokens();
  return (
    <View className={divider ? 'mt-3 border-t border-border-subtle pt-3' : undefined}>
      <View className="flex-row items-center gap-3">
        <View className="flex-1">
          <Text variant="body" numberOfLines={1}>
            {invite.invitedEmailOrPhone}
          </Text>
          <Text variant="caption" className="mt-0.5 text-ink-muted">
            {PERMISSION_LABEL[invite.permission]} · pending
          </Text>
        </View>
        <Pressable
          onPress={onRevoke}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Revoke invite"
          className={cn('rounded-full active:scale-90', focusRing)}>
          <Icon icon={Trash2} size={18} color={t.inkMuted} />
        </Pressable>
      </View>
    </View>
  );
}

function InviteSheet({
  visible,
  listId,
  onClose,
  onInvited,
}: {
  visible: boolean;
  listId: string;
  onClose: () => void;
  onInvited: () => void;
}) {
  const toast = useToast();
  const [target, setTarget] = useState('');
  const [permission, setPermission] = useState<ListPermission>('view');
  const [saving, setSaving] = useState(false);
  const [created, setCreated] = useState<CreatedInvite | null>(null);

  const reset = () => {
    setTarget('');
    setPermission('view');
    setCreated(null);
  };

  const create = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const { invite, emailOutcome } = await listsApi.invite(listId, {
        invitedEmailOrPhone: target.trim() || undefined,
        permission,
      });
      setCreated(invite);
      onInvited();
      if (emailOutcome === 'sent') toast.show('Invite emailed.');
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : "Couldn't create the invite. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const copy = async () => {
    if (!created) return;
    const ok = await copyText(created.acceptUrl);
    toast.show(ok ? 'Invite link copied.' : 'Long-press the link to copy it.');
  };

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Invite to this list">
      {created ? (
        <View>
          <Text variant="body" className="text-ink-secondary">
            Share this link. They must accept before they can see the list (it’s never automatic).
          </Text>
          <View className="mt-3 rounded-md border border-border-subtle bg-surface-sunken p-3">
            <Text variant="caption" selectable className="text-ink">
              {created.acceptUrl}
            </Text>
          </View>
          <View className="mt-4 gap-2">
            <Button leftIcon={Copy} fullWidth onPress={copy}>
              Copy link
            </Button>
            <Button
              variant="ghost"
              fullWidth
              onPress={() => {
                reset();
                onClose();
              }}>
              Done
            </Button>
          </View>
        </View>
      ) : (
        <View>
          <TextField
            label="Email or phone"
            optional
            value={target}
            onChangeText={setTarget}
            placeholder="name@example.com"
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            hint="Leave blank to just create a shareable link."
          />
          <Text variant="label" className="mb-2 mt-4">
            They can
          </Text>
          <View className="flex-row gap-2">
            <View className="flex-1">
              <Chip label="View only" selected={permission === 'view'} onPress={() => setPermission('view')} />
            </View>
            <View className="flex-1">
              <Chip label="Can edit" selected={permission === 'edit'} onPress={() => setPermission('edit')} />
            </View>
          </View>
          <View className="mt-5">
            <Button fullWidth loading={saving} onPress={create}>
              Create invite
            </Button>
          </View>
        </View>
      )}
    </Sheet>
  );
}
