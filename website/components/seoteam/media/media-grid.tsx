"use client";

import { Copy, ExternalLink, ImageOff } from "lucide-react";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cloudinaryThumb, filenameFromPublicId } from "@/lib/blog/image-url";
import type { MediaRow } from "@/lib/blog/types";
import { cn } from "@/lib/utils";

import { displayAlt } from "./lib";

const iconBtn =
  "inline-flex h-7 w-7 items-center justify-center rounded-md text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink";

/** Thumbnail-card grid view of the media library. */
export function MediaGrid({
  rows,
  selectedIds,
  onToggleSelect,
  onCopy,
  onOpenLightbox,
}: {
  rows: MediaRow[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onCopy: (text: string, label?: string) => void;
  onOpenLightbox: (row: MediaRow) => void;
}) {
  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {rows.map((row) => (
        <GridCard
          key={row.image.id}
          row={row}
          selected={selectedIds.has(row.image.id)}
          onToggleSelect={onToggleSelect}
          onCopy={onCopy}
          onOpen={() => onOpenLightbox(row)}
        />
      ))}
    </ul>
  );
}

function GridCard({
  row,
  selected,
  onToggleSelect,
  onCopy,
  onOpen,
}: {
  row: MediaRow;
  selected: boolean;
  onToggleSelect: (id: string) => void;
  onCopy: (text: string, label?: string) => void;
  onOpen: () => void;
}) {
  const [errored, setErrored] = React.useState(false);
  const { image } = row;
  const name = filenameFromPublicId(image.publicId);

  return (
    <li
      className={cn(
        "group relative overflow-hidden rounded-lg border bg-surface",
        selected ? "border-biro" : "border-border-subtle",
      )}
    >
      <span className="absolute left-2 top-2 z-10">
        <Checkbox
          checked={selected}
          onChange={() => onToggleSelect(image.id)}
          aria-label={`Select ${name}`}
        />
      </span>

      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open preview of ${name}`}
        className="block aspect-square w-full bg-surface-sunken"
      >
        {errored ? (
          <span className="flex h-full w-full items-center justify-center text-ink-muted">
            <ImageOff size={22} aria-hidden="true" />
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote URL
          <img
            src={cloudinaryThumb(image.secureUrl, 320)}
            alt={displayAlt(row) || name}
            loading="lazy"
            onError={() => setErrored(true)}
            className="h-full w-full object-cover"
          />
        )}
      </button>

      <div className="p-2.5">
        <p className="truncate text-xs font-medium text-ink" title={image.publicId}>
          {name}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-1">
          <span className="flex flex-wrap gap-1">
            {row.unused && <Badge tone="neutral">Unused</Badge>}
            {row.missingAlt && <Badge tone="warn">Missing alt</Badge>}
          </span>
          <span className="flex shrink-0 items-center gap-0.5">
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
        </div>
      </div>
    </li>
  );
}
