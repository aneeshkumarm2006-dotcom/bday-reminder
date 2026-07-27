"use client";

import { ArrowRight, Plus, Trash2, X } from "lucide-react";
import * as React from "react";

import { AdminSection } from "@/components/seoteam/admin/layout";
import { Button } from "@/components/ui/button";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import {
  createRedirect,
  deleteRedirect,
  dismiss404,
  updateRedirect,
} from "@/lib/content/admin-api";
import type { NotFoundHit, Redirect } from "@/lib/content/types";
import { cn } from "@/lib/utils";

/**
 * Redirect rules plus the 404 log that tells you which ones to write.
 *
 * The pairing is the point: a list of top 404s with a one-click "redirect this"
 * turns a passive error log into a work queue. Obvious scanner noise
 * (`.php`, `wp-*`, `.env`) is filtered out server-side so real broken links
 * stay visible.
 */
export function RedirectsManager({
  redirects: initialRedirects,
  hits: initialHits,
}: {
  redirects: Redirect[];
  hits: NotFoundHit[];
}) {
  const { toast } = useToast();
  const [redirects, setRedirects] = React.useState(initialRedirects);
  const [hits, setHits] = React.useState(initialHits);
  const [from, setFrom] = React.useState("");
  const [to, setTo] = React.useState("");
  const [type, setType] = React.useState<301 | 302>(301);
  const [note, setNote] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const add = async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await createRedirect({ from, to, type, enabled: true, note });
      setRedirects((prev) => [created, ...prev]);
      setFrom("");
      setTo("");
      setNote("");
      toast({ message: "Redirect created.", tone: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not create the redirect.";
      setError(message);
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (redirect: Redirect, enabled: boolean) => {
    setRedirects((prev) =>
      prev.map((r) => (r.id === redirect.id ? { ...r, enabled } : r)),
    );
    try {
      await updateRedirect(redirect.id, { enabled });
    } catch (err) {
      // Put the switch back where it was — the server is the source of truth.
      setRedirects((prev) =>
        prev.map((r) => (r.id === redirect.id ? { ...r, enabled: !enabled } : r)),
      );
      toast({
        message: err instanceof Error ? err.message : "Could not update.",
        tone: "error",
      });
    }
  };

  const remove = async (redirect: Redirect) => {
    setRedirects((prev) => prev.filter((r) => r.id !== redirect.id));
    try {
      await deleteRedirect(redirect.id);
      toast({ message: "Redirect deleted.", tone: "success" });
    } catch (err) {
      setRedirects((prev) => [redirect, ...prev]);
      toast({
        message: err instanceof Error ? err.message : "Could not delete.",
        tone: "error",
      });
    }
  };

  return (
    <>
      <AdminSection
        title="Add a redirect"
        description="From an internal path to an internal path or an https:// URL. Loops and chains are rejected."
      >
        <div className="grid gap-3 sm:grid-cols-[1fr_1fr_7rem]">
          <div>
            <Label htmlFor="redirect-from">From</Label>
            <Input
              id="redirect-from"
              value={from}
              placeholder="/old-page"
              onChange={(e) => setFrom(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="redirect-to">To</Label>
            <Input
              id="redirect-to"
              value={to}
              placeholder="/new-page"
              onChange={(e) => setTo(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="redirect-type">Type</Label>
            <Select
              id="redirect-type"
              value={String(type)}
              onChange={(e) => setType(Number(e.target.value) as 301 | 302)}
            >
              <option value="301">301</option>
              <option value="302">302</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="redirect-note">Note (optional)</Label>
          <Input
            id="redirect-note"
            value={note}
            placeholder="Why this exists"
            onChange={(e) => setNote(e.target.value)}
          />
        </div>
        {error && <p className="text-sm text-danger-fg">{error}</p>}
        <Button
          type="button"
          size="sm"
          className="self-start"
          disabled={busy || !from.trim() || !to.trim()}
          onClick={() => void add()}
        >
          <Plus size={16} aria-hidden="true" />
          {busy ? "Adding…" : "Add redirect"}
        </Button>
        <p className="text-xs text-ink-muted">
          301 is permanent (passes ranking on); 302 is temporary. Redirects resolve when a
          URL would otherwise 404, so they never slow down a page that exists.
        </p>
      </AdminSection>

      <AdminSection title={`Rules (${redirects.length})`}>
        {redirects.length === 0 ? (
          <p className="text-sm text-ink-muted">No redirects yet.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border-subtle">
            <table className="w-full min-w-[42rem] text-left text-sm">
              <thead className="border-b border-border-subtle bg-surface-sunken text-xs uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-2.5 font-medium">Rule</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Hits</th>
                  <th className="px-4 py-2.5 font-medium">Enabled</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {redirects.map((redirect) => (
                  <tr
                    key={redirect.id}
                    className="border-b border-border-subtle last:border-0"
                  >
                    <td className="px-4 py-3">
                      <p className="flex flex-wrap items-center gap-1.5 font-mono text-xs text-ink">
                        {redirect.from}
                        <ArrowRight size={13} className="text-ink-muted" aria-hidden="true" />
                        {redirect.to}
                      </p>
                      {redirect.note && (
                        <p className="mt-0.5 text-xs text-ink-muted">{redirect.note}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-secondary">
                      {redirect.type}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-ink-secondary">
                      {redirect.hits}
                    </td>
                    <td className="px-4 py-3">
                      <Switch
                        checked={redirect.enabled}
                        aria-label={`Enable ${redirect.from}`}
                        onCheckedChange={(enabled) => void toggle(redirect, enabled)}
                      />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        aria-label={`Delete redirect from ${redirect.from}`}
                        onClick={() => void remove(redirect)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted hover:bg-danger-bg hover:text-danger-fg"
                      >
                        <Trash2 size={15} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminSection>

      <AdminSection
        title={`Top 404s (${hits.length})`}
        description="Paths visitors hit that don't exist, most frequent first. Bot noise (.php, wp-*, .env) is filtered out."
      >
        {hits.length === 0 ? (
          <p className="text-sm text-ink-muted">
            Nothing logged yet — that&apos;s the good outcome.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {hits.map((hit) => (
              <li
                key={hit.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border-subtle px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate font-mono text-xs text-ink">{hit.path}</p>
                  <p className="text-xs text-ink-muted">
                    {hit.count} hit{hit.count === 1 ? "" : "s"} · last seen{" "}
                    {hit.lastSeenAt.slice(0, 10)}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => {
                      setFrom(hit.path);
                      setTo("");
                      window.scrollTo({ top: 0, behavior: "smooth" });
                    }}
                  >
                    Create redirect
                  </Button>
                  <button
                    type="button"
                    aria-label={`Dismiss ${hit.path}`}
                    onClick={() => {
                      setHits((prev) => prev.filter((h) => h.id !== hit.id));
                      void dismiss404(hit.path);
                    }}
                    className={cn(
                      "inline-flex h-8 w-8 items-center justify-center rounded-md text-ink-muted",
                      "hover:bg-surface-sunken hover:text-ink",
                    )}
                  >
                    <X size={15} aria-hidden="true" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </AdminSection>
    </>
  );
}
