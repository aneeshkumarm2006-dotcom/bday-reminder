"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudDownload, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Input, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useToast } from "@/components/ui/toast";
import {
  ApiError,
  configApi,
  googleImportApi,
  importApi,
  type ImportCommitItem,
  type ImportPreviewResponse,
  type ImportPreviewRow,
  type ImportResolution,
} from "@/lib/api";
import { parseCsv } from "@/lib/csv";
import { maxDayInMonth, monthAbbr } from "@/lib/dates";
import { useAuth } from "@/providers/auth-provider";

const CURRENT_YEAR = new Date().getFullYear();

/** Local mirror of the commit validation, so we import exactly what the server will accept. */
function rowIssue(r: ImportPreviewRow): string | null {
  if (!r.name.trim()) return "Add a name.";
  const d = r.dob;
  if (!d || !d.month || !d.day) return "Add a birthday (month + day).";
  if (d.month < 1 || d.month > 12) return "Pick a month.";
  if (d.day < 1 || d.day > maxDayInMonth(d.month)) return "That day isn't in the month.";
  if (d.year != null && (d.year < 1900 || d.year > CURRENT_YEAR)) return "Check the year.";
  return null;
}

/**
 * Import people (FR-6/11). Two paths:
 *   • Import from Google — birthdays + anniversaries from Google Calendar + Contacts
 *     (Stage 16). The calendar/contacts permission is requested just-in-time here,
 *     never at login; the preview below is the review/consent step before anything
 *     is written.
 *   • CSV — the browser can't read the address book, so paste or upload a CSV.
 * Both feed the same preview (server-side validation + duplicate detection) →
 * resolve any duplicate (add / merge / skip) → commit.
 */
type Phase = "input" | "preview" | "done";

export default function ImportPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user, refreshUser } = useAuth();

  const [phase, setPhase] = useState<Phase>("input");
  const [csv, setCsv] = useState("");
  const [rows, setRows] = useState<ImportPreviewRow[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, ImportResolution>>({});
  const [busy, setBusy] = useState(false);
  const newRowSeq = useRef(0);
  const [summary, setSummary] = useState<{ added: number; merged: number; skipped: number } | null>(
    null,
  );

  const { data: config } = useQuery({ queryKey: ["config"], queryFn: () => configApi.get() });

  // Move annotated rows into the review phase (shared by CSV + Google sources).
  const applyPreview = useCallback((res: ImportPreviewResponse) => {
    setRows(res.rows);
    // Default resolution: ready→add, duplicate→skip, invalid→skip.
    const defaults: Record<string, ImportResolution> = {};
    res.rows.forEach((r) => {
      defaults[r.id] = r.status === "ready" ? "add" : "skip";
    });
    setResolutions(defaults);
    setPhase("preview");
  }, []);

  // Fetch + preview from the connected Google account (also used after the OAuth
  // round-trip returns to /import?google=connected).
  const runGooglePreview = useCallback(async () => {
    setBusy(true);
    try {
      const res = await googleImportApi.preview();
      if (res.rows.length === 0) {
        toast({
          message: "We didn't find any birthdays in your Google Calendar or Contacts to import.",
          tone: "info",
        });
        return;
      }
      applyPreview(res);
      if (res.truncated) {
        toast({
          message: "Showing the first 2,000. Import them, then run it again for the rest.",
          tone: "info",
        });
      }
    } catch (e) {
      const code = e instanceof ApiError ? (e.data as { code?: string } | null)?.code : undefined;
      if (code === "google_import_disconnected" || code === "google_import_not_connected") {
        await refreshUser();
        toast({ message: "Reconnect your Google account to import.", tone: "error" });
      } else {
        toast({ message: "Couldn't reach Google. Try again.", tone: "error" });
      }
    } finally {
      setBusy(false);
    }
  }, [applyPreview, refreshUser, toast]);

  // "Import from Google" click: connected → preview now; else full-page redirect to
  // Google consent (returns to /import?google=connected, handled below).
  const onImportGoogle = useCallback(async () => {
    if (user?.googleImportConnected) {
      void runGooglePreview();
      return;
    }
    setBusy(true);
    try {
      const { url } = await googleImportApi.connectUrl();
      window.location.href = url;
    } catch {
      toast({ message: "Couldn't start the Google connection. Try again.", tone: "error" });
      setBusy(false);
    }
  }, [user?.googleImportConnected, runGooglePreview, toast]);

  // Surface the outcome of the Google OAuth round-trip (backend redirects back to
  // /import?google=connected|error): on success refresh the user + auto-run the
  // preview, then clean the query so a refresh is quiet.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const outcome = params.get("google");
    if (!outcome) return;
    window.history.replaceState({}, "", "/import");
    if (outcome === "connected") {
      void (async () => {
        await refreshUser();
        await runGooglePreview();
      })();
    } else {
      toast({ message: "Couldn't connect Google. Please try again.", tone: "error" });
    }
    // Run once on mount for the redirect return.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const preview = async () => {
    const candidates = parseCsv(csv);
    if (candidates.length === 0) {
      toast({ message: "No rows found. Check the header row and format.", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const res = await importApi.preview({ candidates });
      applyPreview(res);
    } catch {
      toast({ message: "Couldn't validate the file. Try again.", tone: "error" });
    } finally {
      setBusy(false);
    }
  };

  // --- Editable review list -------------------------------------------------
  // Patch a single field on one row (name / relationship / part of the dob).
  const patchRow = useCallback((id: string, patch: Partial<ImportPreviewRow>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }, []);

  const patchDob = useCallback(
    (id: string, part: "month" | "day" | "year", raw: string) => {
      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const base = r.dob ?? { month: 0, day: 0, year: null };
          const n = raw.trim() === "" ? null : Number(raw);
          const dob = {
            month: part === "month" ? Number(raw) || 0 : base.month,
            day: part === "day" ? n ?? 0 : base.day,
            year: part === "year" ? (n && n > 0 ? n : null) : base.year,
          };
          return { ...r, dob };
        }),
      );
    },
    [],
  );

  const removeRow = useCallback((id: string) => {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }, []);

  const addRow = useCallback(() => {
    const id = `new-${newRowSeq.current++}`;
    setRows((prev) => [
      ...prev,
      {
        id,
        name: "",
        relationshipTag: null,
        phone: null,
        photoUrl: null,
        dob: { month: new Date().getMonth() + 1, day: 0, year: null },
        email: null,
        events: [],
        status: "ready",
        error: null,
        duplicate: null,
      },
    ]);
    setResolutions((prev) => ({ ...prev, [id]: "add" }));
  }, []);

  // The rows that will actually be sent: valid, and not a duplicate the user skipped.
  const importable = useMemo(
    () =>
      rows.filter((r) => {
        if (rowIssue(r)) return false;
        if (r.status === "duplicate") return (resolutions[r.id] ?? "skip") !== "skip";
        return true;
      }),
    [rows, resolutions],
  );
  const incompleteCount = useMemo(() => rows.filter((r) => rowIssue(r)).length, [rows]);

  const commit = async () => {
    const items: ImportCommitItem[] = importable.map((r) => ({
      name: r.name.trim(),
      relationshipTag: r.relationshipTag,
      phone: r.phone,
      dob: r.dob!,
      email: r.email,
      events: r.events,
      resolution: r.status === "duplicate" ? resolutions[r.id] ?? "skip" : "add",
      mergeTargetId: r.duplicate?.personId ?? null,
    }));

    if (items.length === 0) {
      toast({ message: "Nothing to import yet. Add a name and birthday to a row.", tone: "error" });
      return;
    }

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
          {config?.googleImportAvailable && (
            <div className="flex items-center justify-between gap-4 rounded-lg border border-border-subtle bg-surface p-4">
              <div className="flex min-w-0 items-center gap-3">
                <CloudDownload size={20} className="shrink-0 text-ink-muted" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-[15px] font-medium text-ink">Import from Google</p>
                  <p className="mt-0.5 text-sm text-ink-muted">
                    {user?.googleImportConnected
                      ? `Birthdays + anniversaries from Google. Connected as ${user.googleImportEmail}.`
                      : "Birthdays + anniversaries from your Google Calendar and Contacts. You review everything before it’s added."}
                  </p>
                </div>
              </div>
              <Button onClick={onImportGoogle} disabled={busy}>
                {user?.googleImportConnected ? "Sync now" : "Connect"}
              </Button>
            </div>
          )}

          <p className="text-ink-secondary">
            Or paste rows / upload a CSV. The first row is the header. Columns:{" "}
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
          <p className="mb-1 text-ink-secondary">
            Edit anyone, remove rows you don&apos;t want, or add someone we missed — then import.
          </p>
          <p className="mb-4 text-sm text-ink-muted">
            {importable.length} ready to import
            {incompleteCount > 0
              ? ` · ${incompleteCount} need${incompleteCount === 1 ? "s" : ""} a name or birthday`
              : ""}
          </p>

          <ul className="flex flex-col gap-2">
            {rows.map((r) => {
              const issue = rowIssue(r);
              const isDuplicate = r.status === "duplicate";
              return (
                <li
                  key={r.id}
                  className="rounded-lg border border-border-subtle bg-surface p-3"
                >
                  <div className="flex items-start gap-3">
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <Input
                        aria-label="Name"
                        placeholder="Name"
                        value={r.name}
                        onChange={(e) => patchRow(r.id, { name: e.target.value })}
                      />
                      <div className="flex flex-wrap items-center gap-2">
                        <Select
                          aria-label="Birthday month"
                          className="w-28"
                          value={r.dob?.month ? String(r.dob.month) : ""}
                          onChange={(e) => patchDob(r.id, "month", e.target.value)}
                        >
                          <option value="">Month</option>
                          {Array.from({ length: 12 }, (_, i) => (
                            <option key={i + 1} value={String(i + 1)}>
                              {monthAbbr(i + 1)}
                            </option>
                          ))}
                        </Select>
                        <Input
                          aria-label="Birthday day"
                          className="w-20"
                          inputMode="numeric"
                          placeholder="Day"
                          value={r.dob?.day ? String(r.dob.day) : ""}
                          onChange={(e) => patchDob(r.id, "day", e.target.value)}
                        />
                        <Input
                          aria-label="Birth year (optional)"
                          className="w-24"
                          inputMode="numeric"
                          placeholder="Year"
                          value={r.dob?.year ? String(r.dob.year) : ""}
                          onChange={(e) => patchDob(r.id, "year", e.target.value)}
                        />
                      </div>
                      <Input
                        aria-label="Relationship (optional)"
                        placeholder="Relationship (optional)"
                        value={r.relationshipTag ?? ""}
                        onChange={(e) =>
                          patchRow(r.id, { relationshipTag: e.target.value.trim() ? e.target.value : null })
                        }
                      />
                      {r.events.length > 0 && (
                        <p className="text-xs text-ink-muted">
                          +{r.events.length} other{" "}
                          {r.events.length === 1 ? "date" : "dates"} (anniversary/custom) will be added too
                        </p>
                      )}
                      {issue && <p className="text-xs text-danger-fg">{issue}</p>}
                    </div>

                    <button
                      type="button"
                      aria-label={`Remove ${r.name || "row"}`}
                      onClick={() => removeRow(r.id)}
                      className="shrink-0 rounded-md p-2 text-ink-muted transition-colors hover:bg-surface-sunken hover:text-danger-fg"
                    >
                      <Trash2 size={18} aria-hidden="true" />
                    </button>
                  </div>

                  {isDuplicate && (
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <Badge tone="snooze">possible duplicate</Badge>
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
              );
            })}
          </ul>

          <button
            type="button"
            onClick={addRow}
            className="mt-3 flex items-center gap-2 rounded-lg border border-dashed border-border-strong px-3 py-2.5 text-sm font-medium text-ink-secondary transition-colors hover:border-biro hover:text-biro"
          >
            <Plus size={16} aria-hidden="true" />
            Add a person
          </button>

          <div className="mt-6 flex gap-3">
            <Button onClick={commit} disabled={busy || importable.length === 0}>
              Import {importable.length > 0 ? importable.length : ""}
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
