"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CloudDownload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { Textarea } from "@/components/ui/input";
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
import { monthAbbr } from "@/lib/dates";
import { useAuth } from "@/providers/auth-provider";

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

  const commit = async () => {
    const items: ImportCommitItem[] = rows
      .filter((r) => r.status !== "invalid" && r.dob)
      .map((r) => ({
        name: r.name,
        relationshipTag: r.relationshipTag,
        phone: r.phone,
        dob: r.dob!,
        email: r.email,
        events: r.events,
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
                      {r.events.length > 0
                        ? ` · +${r.events.length} ${r.events.length === 1 ? "other date" : "other dates"}`
                        : ""}
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
