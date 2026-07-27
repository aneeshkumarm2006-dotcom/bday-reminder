"use client";

import { Download, History, RotateCcw, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { AdminSection } from "@/components/seoteam/admin/layout";
import { TypedConfirmDialog } from "@/components/seoteam/admin/typed-confirm";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import { fetchAudit, importBundle, restoreRevision } from "@/lib/content/admin-api";
import type { AuditEntry, ContentRevision } from "@/lib/content/types";
import { cn } from "@/lib/utils";

const ENTITY_LABELS: Record<string, string> = {
  site: "Site settings",
  landing: "Landing page",
  page: "Custom page",
  navigation: "Navigation",
  meta: "Page SEO",
  "structured-data": "Structured data",
  legal: "Legal pages",
  redirect: "Redirects",
};

const ACTION_TONE: Record<string, string> = {
  publish: "border-ok-fg/30 bg-ok-bg text-ok-fg",
  create: "border-ok-fg/30 bg-ok-bg text-ok-fg",
  delete: "border-danger-fg/30 bg-danger-bg text-danger-fg",
  restore: "border-warn-fg/30 bg-warn-bg text-warn-fg",
  import: "border-warn-fg/30 bg-warn-bg text-warn-fg",
};

/**
 * The audit feed plus the revision browser and the backup tools.
 *
 * Attribution comes from the editor display name captured at login — the
 * dashboard is one shared password, so "who" is self-declared. It's there to
 * answer "who changed the hero copy?", never to authorize anything.
 */
export function ActivityView({
  entries: initialEntries,
  revisions,
  editors,
}: {
  entries: AuditEntry[];
  revisions: ContentRevision[];
  editors: string[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [entries, setEntries] = React.useState(initialEntries);
  const [entityType, setEntityType] = React.useState("");
  const [editor, setEditor] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [diff, setDiff] = React.useState<ContentRevision | null>(null);
  const [pendingRestore, setPendingRestore] = React.useState<ContentRevision | null>(null);
  const [confirmImport, setConfirmImport] = React.useState<unknown | null>(null);
  const fileRef = React.useRef<HTMLInputElement>(null);

  const applyFilters = async (nextType: string, nextEditor: string) => {
    setEntityType(nextType);
    setEditor(nextEditor);
    setLoading(true);
    try {
      setEntries(
        await fetchAudit({
          entityType: nextType || undefined,
          editor: nextEditor || undefined,
        }),
      );
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : "Could not load activity.",
        tone: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  const restore = async (revision: ContentRevision) => {
    try {
      await restoreRevision(revision.id);
      toast({
        message: "Restored. Nothing was published — review, then publish.",
        tone: "success",
      });
      router.refresh();
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : "Could not restore.",
        tone: "error",
      });
    }
  };

  const runImport = async (bundle: unknown) => {
    try {
      const { applied } = await importBundle(bundle);
      toast({
        message: applied.length ? `Imported ${applied.join(", ")}.` : "Nothing to import.",
        tone: "success",
      });
      router.refresh();
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : "Import failed.",
        tone: "error",
      });
    }
  };

  return (
    <>
      <AdminSection
        title="Backups"
        description="Export before a big edit. Importing writes over settings and adds pages — take an export first."
      >
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            // A full navigation, not a client-side one: the response is a file
            // download from a route handler, so next/link would be wrong here.
            onClick={() => {
              window.location.href = "/seoteam/api/export";
            }}
          >
            <Download size={16} aria-hidden="true" />
            Export everything
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              try {
                setConfirmImport(JSON.parse(await file.text()));
              } catch {
                toast({ message: "That file isn't valid JSON.", tone: "error" });
              }
            }}
          />
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Upload size={16} aria-hidden="true" />
            Import a bundle
          </Button>
        </div>
      </AdminSection>

      <AdminSection title="Activity" description="Every save, publish, and delete.">
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[12rem]">
            <Label htmlFor="filter-entity">Area</Label>
            <Select
              id="filter-entity"
              value={entityType}
              onChange={(e) => void applyFilters(e.target.value, editor)}
            >
              <option value="">All areas</option>
              {Object.entries(ENTITY_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </Select>
          </div>
          <div className="min-w-[12rem]">
            <Label htmlFor="filter-editor">Editor</Label>
            <Select
              id="filter-editor"
              value={editor}
              onChange={(e) => void applyFilters(entityType, e.target.value)}
            >
              <option value="">Everyone</option>
              {editors.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-ink-muted">Loading…</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-ink-muted">No activity recorded yet.</p>
        ) : (
          <ul className="flex flex-col">
            {entries.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-baseline gap-x-2 gap-y-1 border-b border-border-subtle py-2.5 last:border-0"
              >
                <span
                  className={cn(
                    "rounded-full border px-2 py-0.5 text-[11px]",
                    ACTION_TONE[entry.action] ??
                      "border-border-subtle bg-surface-sunken text-ink-secondary",
                  )}
                >
                  {entry.action}
                </span>
                <span className="text-sm text-ink">{entry.summary}</span>
                <span className="ml-auto text-xs text-ink-muted">
                  {entry.editor || "Unknown"} ·{" "}
                  <time dateTime={entry.createdAt}>
                    {entry.createdAt.slice(0, 16).replace("T", " ")}
                  </time>
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      <AdminSection
        title="Revisions"
        description="Snapshots taken before each save. Restoring never publishes — it brings content back as a draft or leaves the publish state alone."
      >
        {revisions.length === 0 ? (
          <p className="text-sm text-ink-muted">No revisions yet.</p>
        ) : (
          <ul className="flex flex-col">
            {revisions.map((revision) => (
              <li
                key={revision.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-subtle py-2.5 last:border-0"
              >
                <History size={15} className="text-ink-muted" aria-hidden="true" />
                <span className="text-sm text-ink">
                  {ENTITY_LABELS[revision.entityType] ?? revision.entityType}
                  {revision.entityId !== "singleton" && (
                    <span className="text-ink-muted"> · {revision.entityId}</span>
                  )}
                </span>
                <span className="text-xs text-ink-muted">
                  {revision.savedBy || "Unknown"} ·{" "}
                  <time dateTime={revision.createdAt}>
                    {revision.createdAt.slice(0, 16).replace("T", " ")}
                  </time>
                </span>
                <span className="ml-auto flex items-center gap-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDiff(revision)}
                  >
                    View
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setPendingRestore(revision)}
                  >
                    <RotateCcw size={15} aria-hidden="true" />
                    Restore
                  </Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>

      <Dialog
        open={diff !== null}
        onClose={() => setDiff(null)}
        title="Revision snapshot"
        description={
          diff
            ? `${ENTITY_LABELS[diff.entityType] ?? diff.entityType} · saved by ${diff.savedBy || "Unknown"}`
            : ""
        }
        className="sm:max-w-3xl"
      >
        <pre className="max-h-[60vh] overflow-auto rounded-md border border-border-subtle bg-surface-sunken p-3 font-mono text-xs text-ink-secondary">
          {diff ? JSON.stringify(diff.snapshot, null, 2) : ""}
        </pre>
      </Dialog>

      <TypedConfirmDialog
        open={pendingRestore !== null}
        onClose={() => setPendingRestore(null)}
        title="Restore this revision?"
        message="Content comes back from the snapshot. Nothing is published — the landing page returns as a draft, and a custom page keeps its current publish state."
        phrase="restore"
        confirmLabel="Restore the snapshot"
        onConfirm={() => {
          if (pendingRestore) void restore(pendingRestore);
        }}
      />

      <TypedConfirmDialog
        open={confirmImport !== null}
        onClose={() => setConfirmImport(null)}
        title="Import this bundle?"
        message="Site settings, navigation, page SEO, and legal copy are overwritten; custom pages and redirects are added. The current state is snapshotted first."
        phrase="import"
        confirmLabel="Import the bundle"
        onConfirm={() => {
          if (confirmImport !== null) void runImport(confirmImport);
        }}
      />
    </>
  );
}
