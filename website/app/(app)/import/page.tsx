"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Textarea } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import {
  importApi,
  type ImportCommitItem,
  type ImportPreviewRow,
  type ImportResolution,
} from "@/lib/api";
import { parseCsv } from "@/lib/csv";
import { monthAbbr } from "@/lib/dates";

/**
 * Import people (FR-6/11). The browser can't read the address book, so this is
 * the CSV path: paste or upload, preview with server-side validation + duplicate
 * detection, resolve each duplicate (add / merge / skip), then commit.
 */
type Phase = "input" | "preview" | "done";

export default function ImportPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>("input");
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, ImportResolution>>({});
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState<{ added: number; merged: number; skipped: number } | null>(
    null,
  );

  const preview = async () => {
    const candidates = parseCsv(csv);
    if (candidates.length === 0) {
      toast({ message: "No rows found. Check the header row and format.", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const res = await importApi.preview({ candidates });
      setRows(res.rows);
      // Default resolution: ready→add, duplicate→skip, invalid→skip.
      const defaults: Record<string, ImportResolution> = {};
      res.rows.forEach((r) => {
        defaults[r.id] = r.status === "ready" ? "add" : "skip";
      });
      setResolutions(defaults);
      setPhase("preview");
    } catch {
      toast({ message: "Couldn't validate the file. Try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    const items: ImportCommitItem[] = rows
      .filter((r) => r.status !== "invalid" && r.dob)
      .map((r) => ({
        name: r.name,
        relationshipTag: r.relationshipTag,
        phone: r.phone,
        dob: r.dob!,
        resolution: resolutions[r.id] ?? "skip",
        mergeTargetId: r.duplicate?.personId ?? null,
      }));

    setBusy(true);
    try {
      const res = await importApi.commit(items);
      setSummary(res.summary);
      setPhase("done");
      qc.invalidateQueries({ queryKey: ["people"] });
      qc.invalidateQueries({ queryKey: ["upcoming"] });
    } catch {
      toast({ message: "Couldn't import. Try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Import people" />

      {phase === "input" && (
        <div className="flex flex-col gap-4">
          <p className="text-ink-secondary">
            Paste rows or upload a CSV. The first row is the header. Columns:{" "}
            <code className="rounded bg-surface-sunken px-1 text-sm">name</code>,{" "}
            <code className="rounded bg-surface-sunken px-1 text-sm">month</code>,{" "}
            <code className="rounded bg-surface-sunken px-1 text-sm">day</code>, optional{" "}
            <code className="rounded bg-surface-sunken px-1 text-sm">year</code>,{" "}
            <code className="rounded bg-surface-sunken px-1 text-sm">relationship</code>,{" "}
            <code className="rounded bg-surface-sunken px-1 text-sm">phone</code>. A single{" "}
            <code className="rounded bg-surface-sunken px-1 text-sm">birthday</code> column
            (MM/DD/YYYY) also works.
          </p>

          <Textarea
            className="min-h-40 font-mono text-sm"
            placeholder={"name,month,day,year,relationship\nAda Lovelace,12,10,1991,Friend"}
            value={csv}
            onChange={(e) => setCsv(e.target.value)}
          />

          <div className="flex items-center gap-3">
            <Button onClick={preview} disabled={busy || !csv.trim()}>
              Preview
            </Button>
            <label className="cursor-pointer text-sm font-medium text-biro hover:underline">
              Upload a CSV file
              <input
                type="file"
                accept=".csv,text/csv"
                className="sr-only"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (file) setCsv(await file.text());
                }}
              />
            </label>
          </div>
        </div>
      )}

      {phase === "preview" && (
        <div>
          <p className="mb-4 text-ink-secondary">
            Review {rows.length} {rows.length === 1 ? "row" : "rows"}. Resolve any duplicates, then
            import.
          </p>
          <ul className="flex flex-col gap-2">
            {rows.map((r) => (
              <li key={r.id} className="rounded-lg border border-border-subtle bg-surface p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">{r.name}</p>
                    <p className="text-sm text-ink-muted">
                      {r.dob ? `${monthAbbr(r.dob.month)} ${r.dob.day}${r.dob.year ? `, ${r.dob.year}` : ""}` : "No date"}
                      {r.relationshipTag ? ` · ${r.relationshipTag}` : ""}
                    </p>
                    {r.error && <p className="mt-0.5 text-xs text-danger-fg">{r.error}</p>}
                  </div>
                  <Badge
                    tone={r.status === "ready" ? "ok" : r.status === "duplicate" ? "snooze" : "danger"}
                  >
                    {r.status}
                  </Badge>
                </div>

                {r.status === "duplicate" && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="text-xs text-ink-muted">
                      Looks like {r.duplicate?.fullName ?? "an existing person"}:
                    </span>
                    {(["merge", "add", "skip"] as ImportResolution[]).map((res) => (
                      <Chip
                        key={res}
                        selected={resolutions[r.id] === res}
                        onClick={() => setResolutions((prev) => ({ ...prev, [r.id]: res }))}
                      >
                        {res === "merge" ? "Merge" : res === "add" ? "Add anyway" : "Skip"}
                      </Chip>
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>

          <div className="mt-6 flex gap-3">
            <Button onClick={commit} disabled={busy}>
              Import
            </Button>
            <Button variant="secondary" onClick={() => setPhase("input")}>
              Back
            </Button>
          </div>
        </div>
      )}

      {phase === "done" && summary && (
        <div className="rounded-lg border border-border-subtle bg-surface p-6 text-center">
          <h2 className="font-display text-xl font-semibold text-ink">Import complete</h2>
          <p className="mt-2 text-ink-secondary">
            {summary.added} added · {summary.merged} merged · {summary.skipped} skipped
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button onClick={() => router.replace("/people")}>See your people</Button>
            <Button
              variant="secondary"
              onClick={() => {
                setCsv("");
                setRows([]);
                setSummary(null);
                setPhase("input");
              }}
            >
              Import more
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
