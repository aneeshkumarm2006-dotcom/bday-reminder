"use client";

import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Code,
  Copy,
  ExternalLink,
  FileCode,
  ImageOff,
  Maximize2,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import Link from "next/link";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { formatBytes, formatDate } from "@/lib/blog/format";
import {
  cloudinaryThumb,
  filenameFromPublicId,
  imageMarkdown,
  imageTag,
} from "@/lib/blog/image-url";
import type { MediaRow } from "@/lib/blog/types";
import { cn } from "@/lib/utils";

import { displayAlt, distinctPosts, type SortDir, type SortKey } from "./lib";

const iconBtn =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink";

export interface MediaTableProps {
  rows: MediaRow[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: (checked: boolean) => void;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  busyIds: Set<string>;
  onCopy: (text: string, label?: string) => void;
  onSaveAlt: (row: MediaRow, alt: string) => void;
  onSaveTags: (row: MediaRow, tags: string[]) => void;
  onDelete: (row: MediaRow) => void;
  onOpenLightbox: (row: MediaRow) => void;
}

export function MediaTable(props: MediaTableProps) {
  const { rows, selectedIds, onToggleSelectAll, sortKey, sortDir, onSort } = props;

  const headerRef = React.useRef<HTMLInputElement>(null);
  const selectedVisible = rows.filter((r) => selectedIds.has(r.image.id)).length;
  const allSelected = rows.length > 0 && selectedVisible === rows.length;
  const someSelected = selectedVisible > 0 && !allSelected;

  React.useEffect(() => {
    if (headerRef.current) headerRef.current.indeterminate = someSelected;
  }, [someSelected]);

  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle">
      <table className="w-full min-w-[68rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border-subtle bg-surface-sunken text-left text-xs uppercase tracking-wide text-ink-muted">
            <th className="w-10 px-3 py-2.5">
              <Checkbox
                ref={headerRef}
                checked={allSelected}
                onChange={(e) => onToggleSelectAll(e.target.checked)}
                aria-label="Select all images"
              />
            </th>
            <th className="px-3 py-2.5 font-medium">Preview</th>
            <SortableTh
              label="Filename"
              column="filename"
              activeKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <th className="px-3 py-2.5 font-medium">Alt text</th>
            <th className="px-3 py-2.5 font-medium">Tags</th>
            <SortableTh
              label="Used in"
              column="usage"
              activeKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableTh
              label="Dimensions"
              column="dimensions"
              activeKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <SortableTh
              label="Size"
              column="size"
              activeKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <th className="px-3 py-2.5 font-medium">Format</th>
            <th className="px-3 py-2.5 font-medium">URL</th>
            <SortableTh
              label="Uploaded"
              column="uploaded"
              activeKey={sortKey}
              sortDir={sortDir}
              onSort={onSort}
            />
            <th className="px-3 py-2.5 text-right font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <MediaTableRow key={row.image.id} row={row} {...props} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SortableTh({
  label,
  column,
  activeKey,
  sortDir,
  onSort,
  className,
}: {
  label: string;
  column: SortKey;
  activeKey: SortKey;
  sortDir: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = activeKey === column;
  return (
    <th
      className={cn("px-3 py-2.5 font-medium", className)}
      aria-sort={active ? (sortDir === "asc" ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(column)}
        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-ink"
      >
        {label}
        {active ? (
          sortDir === "asc" ? (
            <ArrowUp size={12} aria-hidden="true" />
          ) : (
            <ArrowDown size={12} aria-hidden="true" />
          )
        ) : (
          <ArrowUpDown size={12} className="opacity-40" aria-hidden="true" />
        )}
      </button>
    </th>
  );
}

function MediaTableRow({
  row,
  selectedIds,
  onToggleSelect,
  busyIds,
  onCopy,
  onSaveAlt,
  onSaveTags,
  onDelete,
  onOpenLightbox,
}: { row: MediaRow } & MediaTableProps) {
  const { image } = row;
  const name = filenameFromPublicId(image.publicId);
  const alt = displayAlt(row);
  const uploaded = image.cloudinaryCreatedAt ?? image.createdAt;
  const busy = busyIds.has(image.id);

  return (
    <tr
      className={cn(
        "border-b border-border-subtle bg-surface last:border-0",
        busy && "opacity-60",
      )}
      aria-busy={busy}
    >
      <td className="px-3 py-3 align-top">
        <Checkbox
          checked={selectedIds.has(image.id)}
          onChange={() => onToggleSelect(image.id)}
          aria-label={`Select ${name}`}
        />
      </td>

      <td className="px-3 py-3 align-top">
        <Thumb row={row} onOpen={() => onOpenLightbox(row)} />
      </td>

      <td className="px-3 py-3 align-top">
        <span className="block max-w-[12rem] truncate font-medium text-ink" title={image.publicId}>
          {name}
        </span>
      </td>

      <td className="px-3 py-3 align-top">
        <AltCell row={row} onSave={(next) => onSaveAlt(row, next)} />
      </td>

      <td className="px-3 py-3 align-top">
        <TagsCell row={row} onSave={(tags) => onSaveTags(row, tags)} />
      </td>

      <td className="px-3 py-3 align-top">
        <UsedInCell row={row} />
      </td>

      <td className="px-3 py-3 align-top tabular-nums text-ink-secondary">
        {image.width && image.height ? `${image.width} × ${image.height}` : "—"}
      </td>

      <td className="px-3 py-3 align-top tabular-nums text-ink-secondary">
        {formatBytes(image.bytes)}
      </td>

      <td className="px-3 py-3 align-top">
        {image.format ? <Badge tone="neutral">{image.format.toUpperCase()}</Badge> : "—"}
      </td>

      <td className="px-3 py-3 align-top">
        <span className="flex items-center gap-1">
          <span className="block max-w-[9rem] truncate text-xs text-ink-muted" title={image.secureUrl}>
            {image.secureUrl}
          </span>
          <button
            type="button"
            onClick={() => onCopy(image.secureUrl, "URL copied")}
            aria-label="Copy URL"
            title="Copy URL"
            className={iconBtn}
          >
            <Copy size={14} aria-hidden="true" />
          </button>
          <a
            href={image.secureUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Open image in a new tab"
            title="Open"
            className={iconBtn}
          >
            <ExternalLink size={14} aria-hidden="true" />
          </a>
        </span>
      </td>

      <td className="px-3 py-3 align-top text-ink-secondary">{formatDate(uploaded) || "—"}</td>

      <td className="px-3 py-3 align-top">
        <div className="flex justify-end">
          <DropdownMenu
            triggerIcon={<Pencil aria-hidden="true" />}
            triggerLabel={`Actions for ${name}`}
            items={[
              {
                label: "Copy URL",
                icon: <Copy aria-hidden="true" />,
                onSelect: () => onCopy(image.secureUrl, "URL copied"),
              },
              {
                label: "Copy Markdown",
                icon: <FileCode aria-hidden="true" />,
                onSelect: () => onCopy(imageMarkdown(alt, image.secureUrl), "Markdown copied"),
              },
              {
                label: "Copy <img> snippet",
                icon: <Code aria-hidden="true" />,
                onSelect: () => onCopy(imageTag(alt, image.secureUrl), "<img> snippet copied"),
              },
              {
                label: "Preview",
                icon: <Maximize2 aria-hidden="true" />,
                onSelect: () => onOpenLightbox(row),
              },
              {
                label: "Delete",
                icon: <Trash2 aria-hidden="true" />,
                destructive: true,
                onSelect: () => onDelete(row),
              },
            ]}
          />
        </div>
      </td>
    </tr>
  );
}

function Thumb({ row, onOpen }: { row: MediaRow; onOpen: () => void }) {
  const [errored, setErrored] = React.useState(false);
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label="Open preview"
      className="block h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border-subtle bg-surface-sunken"
    >
      {errored ? (
        <span className="flex h-full w-full items-center justify-center text-ink-muted">
          <ImageOff size={16} aria-hidden="true" />
        </span>
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote URL
        <img
          src={cloudinaryThumb(row.image.secureUrl, 96)}
          alt={displayAlt(row) || "Preview"}
          loading="lazy"
          onError={() => setErrored(true)}
          className="h-full w-full object-cover"
        />
      )}
    </button>
  );
}

function AltCell({ row, onSave }: { row: MediaRow; onSave: (alt: string) => void }) {
  const current = displayAlt(row);
  const [editing, setEditing] = React.useState(false);
  const [value, setValue] = React.useState("");

  // Unused images aren't rendered anywhere, so there's no post HTML to edit.
  if (row.unused) {
    return <span className="text-ink-muted">—</span>;
  }

  if (editing) {
    const commit = () => {
      setEditing(false);
      if (value !== current) onSave(value);
    };
    return (
      <input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            e.preventDefault();
            setValue(current);
            setEditing(false);
          }
        }}
        placeholder="Describe the image…"
        aria-label="Edit alt text"
        className="w-full min-w-[11rem] rounded-md border border-border-strong bg-surface px-2 py-1 text-sm text-ink focus:border-biro focus:outline-none"
      />
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setValue(current);
        setEditing(true);
      }}
      className="group flex max-w-[15rem] items-center gap-1.5 text-left"
      aria-label="Edit alt text"
    >
      {row.missingAlt ? (
        <Badge tone="warn">Missing alt</Badge>
      ) : (
        <span className="truncate text-ink">{current}</span>
      )}
      <Pencil
        size={12}
        className="shrink-0 text-ink-muted opacity-0 transition-opacity group-hover:opacity-100"
        aria-hidden="true"
      />
    </button>
  );
}

function TagsCell({ row, onSave }: { row: MediaRow; onSave: (tags: string[]) => void }) {
  const tags = row.image.tags;
  const [adding, setAdding] = React.useState(false);
  const [value, setValue] = React.useState("");

  const addTag = () => {
    const t = value.replace(/,/g, " ").trim();
    setValue("");
    setAdding(false);
    if (!t) return;
    if (tags.some((x) => x.toLowerCase() === t.toLowerCase())) return;
    onSave([...tags, t]);
  };

  return (
    <div className="flex max-w-[13rem] flex-wrap items-center gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex items-center gap-1 rounded-full bg-surface-sunken px-2 py-0.5 text-xs text-ink-secondary"
        >
          {tag}
          <button
            type="button"
            onClick={() => onSave(tags.filter((x) => x !== tag))}
            aria-label={`Remove tag ${tag}`}
            className="text-ink-muted hover:text-danger-fg"
          >
            <X size={11} aria-hidden="true" />
          </button>
        </span>
      ))}

      {adding ? (
        <input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={addTag}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addTag();
            } else if (e.key === "Escape") {
              e.preventDefault();
              setValue("");
              setAdding(false);
            }
          }}
          placeholder="tag"
          aria-label="Add a tag"
          className="w-16 rounded-md border border-border-strong bg-surface px-1.5 py-0.5 text-xs text-ink focus:border-biro focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          aria-label="Add a tag"
          className="inline-flex items-center gap-0.5 rounded-full border border-dashed border-border-strong px-1.5 py-0.5 text-xs text-ink-muted hover:text-ink"
        >
          <Plus size={11} aria-hidden="true" /> tag
        </button>
      )}
    </div>
  );
}

function UsedInCell({ row }: { row: MediaRow }) {
  if (row.unused) return <Badge tone="neutral">Unused</Badge>;
  const posts = distinctPosts(row);
  return (
    <div className="flex max-w-[15rem] flex-col gap-0.5">
      {posts.map((p) => (
        <span key={p.postId} className="flex items-center gap-1.5 text-xs">
          <Link
            href={`/seoteam/posts/${p.postId}/edit`}
            className="truncate text-ink hover:text-biro"
            title={`Edit “${p.title || "Untitled"}”`}
          >
            {p.title || "Untitled"}
          </Link>
          <Link
            href={`/blog/${p.slug}`}
            target="_blank"
            aria-label={`Open “${p.title || "Untitled"}” on the blog`}
            className="shrink-0 text-ink-muted hover:text-biro"
          >
            <ExternalLink size={11} aria-hidden="true" />
          </Link>
        </span>
      ))}
    </div>
  );
}
