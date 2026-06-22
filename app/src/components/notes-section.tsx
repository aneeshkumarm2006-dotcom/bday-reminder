import { Trash2 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { Button, Card, Icon, Input, Text, useConfirm, useToast } from '@/components/ui';
import { ApiError, notesApi, type Note } from '@/lib/api';
import { relativeDate } from '@/lib/dates';
import { useTokens } from '@/theme/theme-provider';

/**
 * Gift notes (DESIGN.md §8.6, PRD §8.9; FR-35/36/37). A running list of
 * separate, timestamped entries — never one overwritable box — so old ideas
 * aren't lost. Each entry shows its text + relative date + a delete; the add
 * input is pinned at the bottom of the section. Shared within a list, but adding
 * and deleting follow Can-edit permission (PRD §14) — `canEdit` hides those for
 * view-only members.
 */
export function NotesSection({ personId, canEdit = true }: { personId: string; canEdit?: boolean }) {
  const t = useTokens();
  const toast = useToast();
  const confirm = useConfirm();

  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await notesApi.list(personId);
        if (active) setNotes(res.notes);
      } catch {
        // The section is non-critical; a transient error just shows the empty copy.
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [personId]);

  const add = async () => {
    const value = text.trim();
    if (!value || saving) return;
    setSaving(true);
    try {
      const { note } = await notesApi.create(personId, value);
      setNotes((cur) => [note, ...cur]); // newest first, matches the server sort
      setText('');
    } catch (e) {
      toast.show(e instanceof ApiError ? e.message : "Couldn't save that note. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (note: Note) => {
    const ok = await confirm({
      title: 'Delete note?',
      message: 'This removes this note entry. This can’t be undone.',
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    try {
      await notesApi.remove(personId, note.id);
      setNotes((cur) => cur.filter((n) => n.id !== note.id));
    } catch {
      toast.show("Couldn't delete that note. Try again.");
    }
  };

  return (
    <View>
      <Text variant="label" className="mb-1 mt-6 text-ink-muted">
        Notes
      </Text>
      <Text variant="caption" className="mb-2">
        Gift ideas, sizes, preferences — only you (and your list) can see these.
      </Text>

      {!loading && notes.length > 0 ? (
        <Card>
          {notes.map((note, i) => (
            <View
              key={note.id}
              className={i > 0 ? 'mt-3 border-t border-border-subtle pt-3' : undefined}>
              <View className="flex-row items-start gap-3">
                <View className="flex-1">
                  <Text variant="body">{note.text}</Text>
                  <Text variant="caption" className="mt-1">
                    {relativeDate(note.createdAt)}
                  </Text>
                </View>
                {canEdit ? (
                  <Pressable
                    onPress={() => void remove(note)}
                    hitSlop={8}
                    accessibilityRole="button"
                    accessibilityLabel="Delete note"
                    className="active:scale-90">
                    <Icon icon={Trash2} size={18} color={t.inkMuted} />
                  </Pressable>
                ) : null}
              </View>
            </View>
          ))}
        </Card>
      ) : !loading ? (
        <Text variant="caption" className="mb-1">
          No notes yet.
        </Text>
      ) : null}

      {/* Add-entry input pinned at the bottom of the notes section (§8.6).
          Hidden for view-only members — adding follows Can-edit (PRD §14). */}
      {canEdit ? (
        <View className="mt-3 flex-row items-end gap-2">
          <View className="flex-1">
            <Input
              value={text}
              onChangeText={setText}
              placeholder="Add a gift idea or note…"
              multiline
              accessibilityLabel="New note"
            />
          </View>
          <Button onPress={add} loading={saving} disabled={!text.trim()}>
            Add
          </Button>
        </View>
      ) : null}
    </View>
  );
}
