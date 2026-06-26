"use client";

import { Gift, Trash2 } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/input";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import { notesApi, type Note } from "@/lib/api";
import { relativeDate } from "@/lib/dates";

/**
 * Gift-idea notes for a person (DESIGN.md §8.6, FR-35/36/37). A running list of
 * timestamped entries with an add box. Author and "X ago" per entry.
 */
export function NotesSection({
  personId,
  initialNotes,
}: {
  personId: string;
  initialNotes: Note[];
}) {
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const confirm = useConfirm();

  const add = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      const { note } = await notesApi.create(personId, trimmed);
      setNotes((prev) => [note, ...prev]);
      setText("");
    } catch {
      toast({ message: "Couldn't save that note. Try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const remove = async (noteId: string) => {
    if (!(await confirm({ title: "Delete this note?", destructive: true, confirmLabel: "Delete" })))
      return;
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    try {
      await notesApi.remove(personId, noteId);
    } catch {
      toast({ message: "Couldn't delete the note.", tone: "error" });
    }
  };

  return (
    <div>
      <div className="flex flex-col gap-2">
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Gift ideas, sizes, preferences…"
          maxLength={2000}
        />
        <div className="flex justify-end">
          <Button size="sm" onClick={add} disabled={busy || !text.trim()}>
            Add note
          </Button>
        </div>
      </div>

      <div className="mt-4">
        {notes.length === 0 ? (
          <EmptyState icon={Gift} title="No notes yet" body="Jot down gift ideas so you're ready." />
        ) : (
          <ul className="flex flex-col gap-2">
            {notes.map((n) => (
              <li
                key={n.id}
                className="group flex items-start justify-between gap-3 rounded-md border border-border-subtle bg-surface p-3"
              >
                <div className="min-w-0">
                  <p className="whitespace-pre-wrap text-sm text-ink">{n.text}</p>
                  <p className="mt-1 text-xs text-ink-muted">{relativeDate(n.createdAt)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => remove(n.id)}
                  aria-label="Delete note"
                  className="shrink-0 rounded-md p-1.5 text-ink-muted hover:bg-danger-bg hover:text-danger-fg"
                >
                  <Trash2 size={16} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
