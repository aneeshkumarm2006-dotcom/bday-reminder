"use client";

import { ChevronDown, ChevronUp, Copy, GripVertical, Plus, Trash2 } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

/**
 * Reorderable list of editable items — feature rows, FAQ pairs, nav links,
 * page blocks, stats, all of it.
 *
 * Reordering is available two ways on purpose: pointer drag (what the SEO team
 * will reach for) and up/down buttons (what keyboard and screen-reader users
 * need — HTML5 drag and drop is unusable without a mouse). Both drive the same
 * `move()`.
 */
export interface ListEditorProps<T> {
  items: T[];
  onChange: (next: T[]) => void;
  /** Stable key per item. */
  keyFor: (item: T, index: number) => string;
  /** Collapsed-row summary. */
  titleFor: (item: T, index: number) => string;
  /** Optional right-aligned subtitle in the row header. */
  subtitleFor?: (item: T, index: number) => string | undefined;
  /** The item's form; `patch` shallow-merges into that item. */
  renderItem: (item: T, index: number, patch: (changes: Partial<T>) => void) => React.ReactNode;
  /** Returns a fresh item; omit to hide the add button. */
  onCreate?: () => T;
  addLabel?: string;
  max?: number;
  allowDuplicate?: boolean;
  /** Start with every row expanded (short lists like nav links). */
  defaultOpen?: boolean;
  emptyLabel?: string;
}

export function ListEditor<T>({
  items,
  onChange,
  keyFor,
  titleFor,
  subtitleFor,
  renderItem,
  onCreate,
  addLabel = "Add item",
  max = 50,
  allowDuplicate = true,
  defaultOpen = false,
  emptyLabel = "Nothing here yet.",
}: ListEditorProps<T>) {
  const [open, setOpen] = React.useState<Record<string, boolean>>({});
  const [dragIndex, setDragIndex] = React.useState<number | null>(null);
  const [overIndex, setOverIndex] = React.useState<number | null>(null);

  const isOpen = (key: string) => open[key] ?? defaultOpen;

  const move = (from: number, to: number) => {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onChange(next);
  };

  const patchAt = (index: number) => (changes: Partial<T>) => {
    onChange(items.map((item, i) => (i === index ? { ...item, ...changes } : item)));
  };

  return (
    <div className="flex flex-col gap-2">
      {items.length === 0 && (
        <p className="rounded-md border border-dashed border-border-subtle px-4 py-6 text-center text-sm text-ink-muted">
          {emptyLabel}
        </p>
      )}

      {items.map((item, index) => {
        const key = keyFor(item, index);
        const expanded = isOpen(key);
        return (
          <div
            key={key}
            onDragOver={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              setOverIndex(index);
            }}
            onDrop={(e) => {
              if (dragIndex === null) return;
              e.preventDefault();
              move(dragIndex, index);
              setDragIndex(null);
              setOverIndex(null);
            }}
            className={cn(
              "rounded-lg border bg-surface transition-colors",
              overIndex === index && dragIndex !== null
                ? "border-biro"
                : "border-border-subtle",
              dragIndex === index && "opacity-50",
            )}
          >
            <div className="flex items-center gap-1 px-2 py-2">
              <span
                draggable
                onDragStart={() => setDragIndex(index)}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                aria-hidden="true"
                title="Drag to reorder"
                className="cursor-grab p-1 text-ink-muted active:cursor-grabbing"
              >
                <GripVertical size={16} />
              </span>

              <button
                type="button"
                onClick={() => setOpen((prev) => ({ ...prev, [key]: !expanded }))}
                aria-expanded={expanded}
                className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-sunken"
              >
                <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">
                  {titleFor(item, index) || "Untitled"}
                </span>
                {subtitleFor?.(item, index) && (
                  <span className="hidden shrink-0 text-xs text-ink-muted sm:inline">
                    {subtitleFor(item, index)}
                  </span>
                )}
              </button>

              <div className="flex shrink-0 items-center">
                <IconButton
                  label="Move up"
                  disabled={index === 0}
                  onClick={() => move(index, index - 1)}
                >
                  <ChevronUp size={16} />
                </IconButton>
                <IconButton
                  label="Move down"
                  disabled={index === items.length - 1}
                  onClick={() => move(index, index + 1)}
                >
                  <ChevronDown size={16} />
                </IconButton>
                {allowDuplicate && (
                  <IconButton
                    label="Duplicate"
                    disabled={items.length >= max}
                    onClick={() => {
                      const next = [...items];
                      next.splice(index + 1, 0, {
                        ...item,
                        ...(typeof (item as { id?: unknown }).id === "string"
                          ? { id: `${(item as { id: string }).id}-copy-${next.length}` }
                          : {}),
                      });
                      onChange(next);
                    }}
                  >
                    <Copy size={15} />
                  </IconButton>
                )}
                <IconButton
                  label="Remove"
                  destructive
                  onClick={() => onChange(items.filter((_, i) => i !== index))}
                >
                  <Trash2 size={15} />
                </IconButton>
              </div>
            </div>

            {expanded && (
              <div className="flex flex-col gap-4 border-t border-border-subtle p-4">
                {renderItem(item, index, patchAt(index))}
              </div>
            )}
          </div>
        );
      })}

      {onCreate && (
        <button
          type="button"
          disabled={items.length >= max}
          onClick={() => {
            const created = onCreate();
            onChange([...items, created]);
            setOpen((prev) => ({ ...prev, [keyFor(created, items.length)]: true }));
          }}
          className="inline-flex h-10 items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong text-sm font-medium text-ink-secondary transition-colors hover:border-biro hover:text-ink disabled:opacity-50"
        >
          <Plus size={16} aria-hidden="true" />
          {addLabel}
        </button>
      )}
    </div>
  );
}

function IconButton({
  label,
  children,
  onClick,
  disabled,
  destructive,
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:opacity-30",
        destructive
          ? "text-ink-muted hover:bg-danger-bg hover:text-danger-fg"
          : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}

/** Short random id for newly created list items (stable across a save). */
export function newId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
