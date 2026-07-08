"use client";

import { Code, Copy, ExternalLink, FileCode } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { formatBytes, formatDate } from "@/lib/blog/format";
import {
  filenameFromPublicId,
  imageMarkdown,
  imageTag,
} from "@/lib/blog/image-url";
import type { MediaRow } from "@/lib/blog/types";
import { cn } from "@/lib/utils";

import { displayAlt } from "./lib";

/** Full-size preview + metadata + copy helpers, in the shared Dialog modal. */
export function MediaLightbox({
  row,
  onClose,
  onCopy,
}: {
  row: MediaRow | null;
  onClose: () => void;
  onCopy: (text: string, label?: string) => void;
}) {
  if (!row) return null;
  const { image } = row;
  const alt = displayAlt(row);
  const uploaded = image.cloudinaryCreatedAt ?? image.createdAt;

  return (
    <Dialog
      open
      onClose={onClose}
      title={filenameFromPublicId(image.publicId)}
      className="sm:max-w-2xl"
    >
      <div className="space-y-4">
        <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface-sunken">
          {/* eslint-disable-next-line @next/next/no-img-element -- arbitrary remote URL */}
          <img
            src={image.secureUrl}
            alt={alt || filenameFromPublicId(image.publicId)}
            className="mx-auto max-h-[60vh] w-auto object-contain"
          />
        </div>

        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-3">
          <Meta
            label="Dimensions"
            value={image.width && image.height ? `${image.width} × ${image.height}` : "—"}
          />
          <Meta label="Size" value={formatBytes(image.bytes)} />
          <Meta label="Format" value={image.format ? image.format.toUpperCase() : "—"} />
          <Meta label="Uploaded" value={formatDate(uploaded) || "—"} />
          <Meta
            label="Used in"
            value={row.unused ? "Unused" : `${row.usedInPosts.length} place(s)`}
          />
          <Meta label="Alt text" value={alt || "Missing"} />
        </dl>

        {image.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {image.tags.map((tag) => (
              <Badge key={tag} tone="neutral">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onCopy(image.secureUrl, "URL copied")}
          >
            <Copy aria-hidden="true" /> Copy URL
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onCopy(imageMarkdown(alt, image.secureUrl), "Markdown copied")}
          >
            <FileCode aria-hidden="true" /> Copy Markdown
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onCopy(imageTag(alt, image.secureUrl), "<img> snippet copied")}
          >
            <Code aria-hidden="true" /> Copy &lt;img&gt;
          </Button>
          <a
            href={image.secureUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          >
            <ExternalLink aria-hidden="true" /> Open original
          </a>
        </div>
      </div>
    </Dialog>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 text-ink">{value}</dd>
    </div>
  );
}
