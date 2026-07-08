"use client";

import {
  Copy,
  Images,
  LayoutGrid,
  RefreshCw,
  Table as TableIcon,
  Tag,
  Trash2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { useToast } from "@/components/ui/toast";
import {
  bulkMediaRequest,
  deleteImageRequest,
  fetchMediaRows,
  syncMediaRequest,
  updateImageRequest,
} from "@/lib/blog/dashboard-api";
import type { MediaRow } from "@/lib/blog/types";
import { cn } from "@/lib/utils";

import {
  distinctPosts,
  filterRows,
  sortRows,
  useStoredView,
  type MediaFilter,
  type SortDir,
  type SortKey,
  type ViewMode,
} from "./lib";
import { MediaGrid } from "./media-grid";
import { MediaLightbox } from "./media-lightbox";
import { MediaTable } from "./media-table";

export function MediaGallery({
  initialRows,
  cloudinaryReady,
}: {
  initialRows: MediaRow[];
  cloudinaryReady: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [rows, setRows] = React.useState(initialRows);
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<MediaFilter>("all");
  const [sortKey, setSortKey] = React.useState<SortKey>("uploaded");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [view, setView] = useStoredView();
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [busyIds, setBusyIds] = React.useState<Set<string>>(new Set());
  const [syncing, setSyncing] = React.useState(false);
  const [bulkTagInput, setBulkTagInput] = React.useState("");
  const [lightboxRow, setLightboxRow] = React.useState<MediaRow | null>(null);

  const visible = React.useMemo(
    () => sortRows(filterRows(rows, search, filter), sortKey, sortDir),
    [rows, search, filter, sortKey, sortDir],
  );

  // ── Selection ──────────────────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleSelectAll = (checked: boolean) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const r of visible) {
        if (checked) next.add(r.image.id);
        else next.delete(r.image.id);
      }
      return next;
    });

  const clearSelection = () => setSelectedIds(new Set());

  const onSort = (key: SortKey) => {
    if (key === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "filename" ? "asc" : "desc");
    }
  };

  const onSortSelect = (value: string) => {
    const [key, dir] = value.split(":") as [SortKey, SortDir];
    setSortKey(key);
    setSortDir(dir);
  };

  // ── Helpers ────────────────────────────────────────────────────────────
  const copy = async (text: string, label = "Copied") => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ message: `${label}.`, tone: "success" });
    } catch {
      toast({ message: "Couldn't copy to clipboard.", tone: "error" });
    }
  };

  const withBusy = async (id: string, fn: () => Promise<void>) => {
    setBusyIds((prev) => new Set(prev).add(id));
    try {
      await fn();
    } finally {
      setBusyIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    }
  };

  const replaceRow = (updated: MediaRow) =>
    setRows((prev) => prev.map((r) => (r.image.id === updated.image.id ? updated : r)));

  // ── Mutations (optimistic + rollback) ──────────────────────────────────
  const saveAlt = (row: MediaRow, alt: string) =>
    withBusy(row.image.id, async () => {
      const prev = rows;
      const trimmed = alt.trim();
      setRows((rs) =>
        rs.map((r) =>
          r.image.id === row.image.id
            ? {
                ...r,
                usedInPosts: r.usedInPosts.map((u) => ({ ...u, alt: trimmed })),
                missingAlt: r.usedInPosts.length > 0 && trimmed === "",
              }
            : r,
        ),
      );
      try {
        replaceRow(await updateImageRequest(row.image.id, { alt }));
        toast({ message: "Alt text saved to the post(s).", tone: "success" });
        router.refresh(); // revalidate the public blog pages that changed
      } catch (err) {
        setRows(prev);
        toast({
          message: err instanceof Error ? err.message : "Couldn't save alt text.",
          tone: "error",
        });
      }
    });

  const saveTags = (row: MediaRow, tags: string[]) =>
    withBusy(row.image.id, async () => {
      const prev = rows;
      setRows((rs) =>
        rs.map((r) =>
          r.image.id === row.image.id
            ? { ...r, image: { ...r.image, tags } }
            : r,
        ),
      );
      try {
        replaceRow(await updateImageRequest(row.image.id, { tags }));
      } catch (err) {
        setRows(prev);
        toast({
          message: err instanceof Error ? err.message : "Couldn't save tags.",
          tone: "error",
        });
      }
    });

  const removeImage = async (row: MediaRow) => {
    const posts = distinctPosts(row);
    const ok = await confirm({
      title: "Delete this image?",
      message: row.unused
        ? "This permanently removes it from Cloudinary. This can't be undone."
        : `This image is used in ${posts.length} post(s). Deleting it from Cloudinary will leave broken images there. This can't be undone.`,
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    const prev = rows;
    setRows((rs) => rs.filter((r) => r.image.id !== row.image.id));
    setSelectedIds((s) => {
      const next = new Set(s);
      next.delete(row.image.id);
      return next;
    });
    try {
      await deleteImageRequest(row.image.id);
      toast({ message: "Image deleted.", tone: "success" });
      router.refresh();
    } catch (err) {
      setRows(prev);
      toast({
        message: err instanceof Error ? err.message : "Couldn't delete the image.",
        tone: "error",
      });
    }
  };

  const runSync = async () => {
    setSyncing(true);
    try {
      const summary = await syncMediaRequest();
      setRows(await fetchMediaRows());
      clearSelection();
      toast({
        message: `Synced: ${summary.added} added, ${summary.updated} updated${
          summary.removed ? `, ${summary.removed} removed` : ""
        }.`,
        tone: "success",
      });
    } catch (err) {
      toast({ message: err instanceof Error ? err.message : "Sync failed.", tone: "error" });
    } finally {
      setSyncing(false);
    }
  };

  // ── Bulk actions ───────────────────────────────────────────────────────
  const bulkDelete = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) return;
    const ok = await confirm({
      title: `Delete ${ids.length} image(s)?`,
      message:
        "This permanently removes them from Cloudinary. Posts still using them will show broken images. This can't be undone.",
      confirmLabel: "Delete",
      destructive: true,
    });
    if (!ok) return;

    const prev = rows;
    setRows((rs) => rs.filter((r) => !selectedIds.has(r.image.id)));
    clearSelection();
    try {
      const { affected } = await bulkMediaRequest({ action: "delete", ids });
      toast({ message: `Deleted ${affected} image(s).`, tone: "success" });
      router.refresh();
    } catch (err) {
      setRows(prev);
      toast({
        message: err instanceof Error ? err.message : "Bulk delete failed.",
        tone: "error",
      });
    }
  };

  const bulkTag = async (action: "addTag" | "removeTag") => {
    const ids = [...selectedIds];
    const tag = bulkTagInput.trim();
    if (ids.length === 0 || !tag) return;
    try {
      const { affected } = await bulkMediaRequest({ action, ids, tag });
      setRows(await fetchMediaRows()); // reload — tag merges across many images
      setBulkTagInput("");
      toast({
        message: `${action === "addTag" ? "Tagged" : "Untagged"} ${affected} image(s).`,
        tone: "success",
      });
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : "Bulk tag action failed.",
        tone: "error",
      });
    }
  };

  const bulkCopyUrls = () => {
    const urls = rows
      .filter((r) => selectedIds.has(r.image.id))
      .map((r) => r.image.secureUrl)
      .join("\n");
    if (urls) copy(urls, `${selectedIds.size} URL(s) copied`);
  };

  // ── Render ─────────────────────────────────────────────────────────────
  if (rows.length === 0 && !syncing) {
    return (
      <>
        {!cloudinaryReady && <CloudinaryNotice />}
        <EmptyState
          icon={Images}
          title="No images tracked yet"
          body={
            cloudinaryReady
              ? "Run a sync to import your Cloudinary media library, then audit alt text and usage here."
              : "Upload images from the post editor, or configure Cloudinary to sync your full library."
          }
          action={
            cloudinaryReady ? (
              <Button onClick={runSync} disabled={syncing}>
                <RefreshCw size={18} aria-hidden="true" /> Sync now
              </Button>
            ) : undefined
          }
        />
      </>
    );
  }

  return (
    <div>
      {!cloudinaryReady && <CloudinaryNotice />}

      {/* Toolbar */}
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center">
        <Input
          placeholder="Search filename, tags, alt, post…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="lg:max-w-xs"
          aria-label="Search images"
        />
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={filter}
            onChange={(e) => setFilter(e.target.value as MediaFilter)}
            className="w-[10rem]"
            aria-label="Filter images"
          >
            <option value="all">All images</option>
            <option value="used">Used</option>
            <option value="unused">Unused</option>
            <option value="missing-alt">Missing alt</option>
          </Select>
          <Select
            value={`${sortKey}:${sortDir}`}
            onChange={(e) => onSortSelect(e.target.value)}
            className="w-[11rem]"
            aria-label="Sort images"
          >
            <option value="uploaded:desc">Newest first</option>
            <option value="uploaded:asc">Oldest first</option>
            <option value="filename:asc">Name A–Z</option>
            <option value="filename:desc">Name Z–A</option>
            <option value="size:desc">Largest size</option>
            <option value="size:asc">Smallest size</option>
            <option value="dimensions:desc">Largest dimensions</option>
            <option value="usage:desc">Most used</option>
            <option value="usage:asc">Least used</option>
          </Select>

          <div
            className="inline-flex overflow-hidden rounded-md border border-border-strong"
            role="group"
            aria-label="View mode"
          >
            <ViewToggleButton
              active={view === "grid"}
              onClick={() => setView("grid")}
              label="Grid view"
            >
              <LayoutGrid size={18} aria-hidden="true" />
            </ViewToggleButton>
            <ViewToggleButton
              active={view === "table"}
              onClick={() => setView("table")}
              label="Table view"
              bordered
            >
              <TableIcon size={18} aria-hidden="true" />
            </ViewToggleButton>
          </div>

          <Button
            variant="secondary"
            onClick={runSync}
            disabled={syncing || !cloudinaryReady}
            title={cloudinaryReady ? "Sync from Cloudinary" : "Cloudinary isn't configured"}
          >
            <RefreshCw size={18} className={cn(syncing && "animate-spin")} aria-hidden="true" />
            <span className="hidden sm:inline">{syncing ? "Syncing…" : "Sync"}</span>
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg border border-border-subtle bg-surface-sunken px-3 py-2">
          <span className="text-sm font-medium text-ink">{selectedIds.size} selected</span>
          <span className="flex items-center gap-1">
            <Input
              value={bulkTagInput}
              onChange={(e) => setBulkTagInput(e.target.value)}
              placeholder="tag…"
              className="h-9 w-28"
              aria-label="Tag for bulk action"
            />
            <Button
              variant="secondary"
              size="sm"
              onClick={() => bulkTag("addTag")}
              disabled={!bulkTagInput.trim()}
            >
              <Tag size={16} aria-hidden="true" /> Add
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => bulkTag("removeTag")}
              disabled={!bulkTagInput.trim()}
            >
              Remove
            </Button>
          </span>
          <Button variant="secondary" size="sm" onClick={bulkCopyUrls}>
            <Copy size={16} aria-hidden="true" /> Copy URLs
          </Button>
          <Button variant="destructive" size="sm" onClick={bulkDelete}>
            <Trash2 size={16} aria-hidden="true" /> Delete
          </Button>
          <button
            type="button"
            onClick={clearSelection}
            className="ml-auto text-sm text-ink-muted hover:text-ink"
          >
            Clear
          </button>
        </div>
      )}

      {/* Views */}
      {syncing && rows.length === 0 ? (
        <MediaSkeleton view={view} />
      ) : visible.length === 0 ? (
        <p className="rounded-lg border border-border-subtle bg-surface px-4 py-12 text-center text-sm text-ink-muted">
          No images match your filters.
        </p>
      ) : view === "grid" ? (
        <MediaGrid
          rows={visible}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onCopy={copy}
          onOpenLightbox={setLightboxRow}
        />
      ) : (
        <MediaTable
          rows={visible}
          selectedIds={selectedIds}
          onToggleSelect={toggleSelect}
          onToggleSelectAll={toggleSelectAll}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={onSort}
          busyIds={busyIds}
          onCopy={copy}
          onSaveAlt={saveAlt}
          onSaveTags={saveTags}
          onDelete={removeImage}
          onOpenLightbox={setLightboxRow}
        />
      )}

      <p className="mt-3 text-xs text-ink-muted">
        {visible.length} of {rows.length} image{rows.length === 1 ? "" : "s"}
      </p>

      <MediaLightbox row={lightboxRow} onClose={() => setLightboxRow(null)} onCopy={copy} />
    </div>
  );
}

function ViewToggleButton({
  active,
  onClick,
  label,
  bordered,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  bordered?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={label}
      className={cn(
        "inline-flex h-11 w-11 items-center justify-center transition-colors",
        bordered && "border-l border-border-strong",
        active ? "bg-biro text-paper" : "bg-surface text-ink-muted hover:bg-surface-sunken",
      )}
    >
      {children}
    </button>
  );
}

function CloudinaryNotice() {
  return (
    <div className="mb-4 rounded-lg border border-border-subtle bg-warn-bg p-4 text-sm text-warn-fg">
      Cloudinary isn&apos;t configured, so syncing the full library is disabled. Set the{" "}
      <code>CLOUDINARY_*</code> env vars to import and manage every asset.
    </div>
  );
}

function MediaSkeleton({ view }: { view: ViewMode }) {
  if (view === "grid") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square w-full rounded-lg" />
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-14 w-full" />
      ))}
    </div>
  );
}
