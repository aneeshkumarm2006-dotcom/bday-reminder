"use client";

import { Plus } from "lucide-react";
import * as React from "react";

import { BlockForm } from "@/components/seoteam/admin/block-forms";
import { ListEditor, newId } from "@/components/seoteam/admin/list-editor";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  BLOCK_BY_TYPE,
  blockDefinitionsByGroup,
  blockTitle,
  type BlockDefinition,
} from "@/lib/content/blocks";
import { iconFor } from "@/lib/content/icons";
import type { PageBlock } from "@/lib/content/types";

/**
 * The "add a block" palette, grouped and searchable.
 *
 * Shared by every surface that can hold blocks — the page builder, the
 * homepage's blocks section, a keyword page's layout, and the built-in pages —
 * so a block added to `lib/content/blocks.ts` shows up in all four at once and
 * the four can't drift into different palettes.
 *
 * Note the explicit `type="button"` on the tiles: this site's Dialog isn't a
 * portal, so a bare button inside a form-embedded dialog submits the outer form.
 */
export function BlockPaletteDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (definition: BlockDefinition) => void;
}) {
  const [query, setQuery] = React.useState("");
  const needle = query.trim().toLowerCase();

  const groups = blockDefinitionsByGroup()
    .map((group) => ({
      ...group,
      blocks: group.blocks.filter(
        (definition) =>
          !needle ||
          definition.label.toLowerCase().includes(needle) ||
          definition.description.toLowerCase().includes(needle),
      ),
    }))
    .filter((group) => group.blocks.length > 0);

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Add a block"
      description="Every block reuses the site's own section styling."
      className="sm:max-w-2xl"
    >
      <Input
        value={query}
        placeholder="Search blocks"
        onChange={(e) => setQuery(e.target.value)}
        className="mb-4"
      />
      <div className="max-h-[60vh] overflow-y-auto pr-1">
        {groups.length === 0 && (
          <p className="py-8 text-center text-sm text-ink-muted">No blocks match that.</p>
        )}
        {groups.map((group) => (
          <div key={group.group} className="mb-5 last:mb-0">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
              {group.group}
            </p>
            <ul className="grid gap-2 sm:grid-cols-2">
              {group.blocks.map((definition) => {
                const Icon = iconFor(definition.icon);
                return (
                  <li key={definition.type}>
                    <button
                      type="button"
                      onClick={() => {
                        onPick(definition);
                        setQuery("");
                      }}
                      className="flex w-full gap-3 rounded-lg border border-border-subtle p-3 text-left transition-colors hover:border-biro hover:bg-surface-sunken"
                    >
                      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-biro-tint text-biro">
                        <Icon size={18} aria-hidden="true" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium text-ink">
                          {definition.label}
                        </span>
                        <span className="block text-xs text-ink-muted">
                          {definition.description}
                        </span>
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </Dialog>
  );
}

/**
 * A reorderable list of blocks with each block's form inline.
 *
 * The page builder has its own two-pane layout (a rail plus a big form) because
 * a whole page is edited there. Everywhere blocks are a *part* of something
 * else — a homepage section, a band on a keyword page, the strip under a blog
 * post — this compact version is the right shape, and it means all of those
 * surfaces get the same palette, the same reordering, and the same forms.
 */
export function BlockListEditor({
  blocks,
  onChange,
  onError,
  max = 40,
  label = "Blocks",
  emptyLabel = "No blocks yet. Add one to put anything you like here.",
}: {
  blocks: PageBlock[];
  onChange: (next: PageBlock[]) => void;
  onError: (message: string) => void;
  max?: number;
  label?: string;
  emptyLabel?: string;
}) {
  const [paletteOpen, setPaletteOpen] = React.useState(false);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <p className="text-sm font-medium text-ink">{label}</p>
        <button
          type="button"
          disabled={blocks.length >= max}
          onClick={() => setPaletteOpen(true)}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken disabled:opacity-50"
        >
          <Plus size={15} aria-hidden="true" />
          Add block
        </button>
      </div>

      <ListEditor
        items={blocks}
        onChange={onChange}
        keyFor={(block) => block.id}
        titleFor={(block) => blockTitle(block)}
        subtitleFor={(block) => BLOCK_BY_TYPE[block.type]?.label}
        max={max}
        emptyLabel={emptyLabel}
        renderItem={(block, _i, patch) => (
          <BlockForm
            block={block}
            patch={patch as (changes: Record<string, unknown>) => void}
            onError={onError}
          />
        )}
      />

      <BlockPaletteDialog
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onPick={(definition) => {
          onChange([...blocks, definition.create(newId(definition.type))]);
          setPaletteOpen(false);
        }}
      />
    </div>
  );
}
