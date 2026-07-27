"use client";

import { ImageIcon, Loader2, Upload } from "lucide-react";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import {
  fetchMediaRows,
  fileToDataUri,
  uploadImageRequest,
} from "@/lib/blog/dashboard-api";
import type { MediaRow } from "@/lib/blog/types";
import { cn } from "@/lib/utils";

/**
 * Reusable image field backed by the existing media library.
 *
 * Every image input in the admin — OG images, `imageText` blocks, the
 * announcement bar — uses this, so there's one upload path, one inventory, and
 * one place alt text is prompted for. The URL stays editable by hand for images
 * hosted elsewhere.
 *
 * Note the explicit `type="button"` throughout: the site's Dialog isn't a
 * portal, so a bare button inside a form-embedded dialog submits the outer form.
 */
export function MediaPickerField({
  label = "Image",
  value,
  onChange,
  helper,
}: {
  label?: string;
  value: string;
  onChange: (url: string) => void;
  helper?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const id = React.useId();

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="flex gap-2">
        <Input
          id={id}
          value={value}
          placeholder="https://… or pick from the library"
          onChange={(e) => onChange(e.target.value)}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-11 shrink-0"
          onClick={() => setOpen(true)}
        >
          <ImageIcon size={16} aria-hidden="true" />
          Browse
        </Button>
      </div>
      {value ? (
        // Plain <img>: arbitrary admin-entered hosts aren't in next/image's allowlist.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={value}
          alt=""
          className="mt-2 h-24 rounded-md border border-border-subtle object-cover"
        />
      ) : null}
      {helper && <p className="mt-1.5 text-xs text-ink-muted">{helper}</p>}

      <MediaPickerDialog
        open={open}
        onClose={() => setOpen(false)}
        onPick={(url) => {
          onChange(url);
          setOpen(false);
        }}
      />
    </div>
  );
}

export function MediaPickerDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (url: string) => void;
}) {
  const [rows, setRows] = React.useState<MediaRow[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const fileRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    if (!open || rows) return;
    let cancelled = false;
    fetchMediaRows()
      .then((next) => !cancelled && setRows(next))
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not load the library.");
        setRows([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, rows]);

  const upload = async (file: File) => {
    setBusy(true);
    setError(null);
    try {
      const url = await uploadImageRequest(await fileToDataUri(file));
      // Drop the cache so the new asset shows up next time the dialog opens.
      setRows(null);
      onPick(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  const filtered = (rows ?? []).filter((row) =>
    query.trim()
      ? row.image.publicId.toLowerCase().includes(query.trim().toLowerCase())
      : true,
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Media library"
      description="Pick an existing image or upload a new one."
      className="sm:max-w-3xl"
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          value={query}
          placeholder="Search by file name"
          onChange={(e) => setQuery(e.target.value)}
          className="max-w-xs"
        />
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Upload size={16} aria-hidden="true" />
          )}
          Upload
        </Button>
      </div>

      {error && <p className="mb-3 text-sm text-danger-fg">{error}</p>}

      {rows === null ? (
        <p className="py-8 text-center text-sm text-ink-muted">Loading the library…</p>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-ink-muted">
          No images yet. Upload one to get started.
        </p>
      ) : (
        <ul className="grid max-h-[50vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-4">
          {filtered.map((row) => (
            <li key={row.image.id}>
              <button
                type="button"
                onClick={() => onPick(row.image.secureUrl)}
                className={cn(
                  "group block w-full overflow-hidden rounded-md border border-border-subtle transition-colors hover:border-biro",
                )}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={row.image.secureUrl}
                  alt=""
                  loading="lazy"
                  className="aspect-square w-full bg-surface-sunken object-cover"
                />
                <span className="block truncate px-2 py-1 text-left text-[11px] text-ink-muted">
                  {row.image.publicId.split("/").pop()}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}
