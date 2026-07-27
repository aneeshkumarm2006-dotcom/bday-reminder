"use client";

import { ExternalLink, RotateCcw, X } from "lucide-react";
import Link from "next/link";
import * as React from "react";

import {
  StringListEditor,
  TextAreaRow,
  TextRow,
} from "@/components/seoteam/admin/fields";
import { FieldGrid } from "@/components/seoteam/admin/layout";
import {
  GoogleSnippetPreview,
  SocialCardPreview,
} from "@/components/seoteam/admin/snippet-preview";
import { Button } from "@/components/ui/button";
import { Label, Textarea } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ToggleRow } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { resetPageMeta, savePageMeta } from "@/lib/content/admin-api";
import { analyzePageSeo, seoVerdict } from "@/lib/content/page-seo";
import type { RouteRow } from "@/lib/content/routes";
import type { ChangeFrequency, PageMeta } from "@/lib/content/types";
import { validateJsonLd } from "@/lib/content/validation";
import { cn } from "@/lib/utils";

const TONE_CLASS = {
  pass: "border-ok-fg/30 bg-ok-bg text-ok-fg",
  warn: "border-warn-fg/30 bg-warn-bg text-warn-fg",
  fail: "border-danger-fg/30 bg-danger-bg text-danger-fg",
} as const;

/**
 * Every public route in one table, with the effective title/description and an
 * SEO-health badge. Selecting a row opens a side panel holding the full
 * `PageMeta` — the same fields the blog editor exposes per post, plus sitemap
 * tuning and per-page JSON-LD.
 */
export function MetaManager({ rows: initialRows }: { rows: RouteRow[] }) {
  const { toast } = useToast();
  const [rows, setRows] = React.useState(initialRows);
  const [openPath, setOpenPath] = React.useState<string | null>(null);

  const selected = rows.find((r) => r.path === openPath) ?? null;

  const applyRow = (path: string, meta: PageMeta, hasOverride: boolean) =>
    setRows((prev) =>
      prev.map((row) => (row.path === path ? { ...row, meta, hasOverride } : row)),
    );

  return (
    <>
      <div className="overflow-x-auto rounded-lg border border-border-subtle">
        <table className="w-full min-w-[46rem] text-left text-sm">
          <thead className="border-b border-border-subtle bg-surface-sunken text-xs uppercase tracking-wide text-ink-muted">
            <tr>
              <th className="px-4 py-2.5 font-medium">Route</th>
              <th className="px-4 py-2.5 font-medium">Title</th>
              <th className="px-4 py-2.5 font-medium">Indexing</th>
              <th className="px-4 py-2.5 font-medium">Health</th>
              <th className="px-4 py-2.5" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const verdict = seoVerdict(analyzePageSeo(row.meta));
              return (
                <tr
                  key={row.path}
                  className="border-b border-border-subtle last:border-0 hover:bg-surface-sunken/60"
                >
                  <td className="px-4 py-3 align-top">
                    <p className="font-medium text-ink">{row.label}</p>
                    <p className="text-xs text-ink-muted">{row.path}</p>
                  </td>
                  <td className="max-w-xs px-4 py-3 align-top">
                    <p className="truncate text-ink">
                      {row.meta.title || <span className="text-ink-muted">Inherits default</span>}
                    </p>
                    <p className="truncate text-xs text-ink-muted">
                      {row.meta.description || "No description"}
                    </p>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-xs",
                        row.meta.noindex
                          ? TONE_CLASS.fail
                          : "border-border-subtle bg-surface text-ink-secondary",
                      )}
                    >
                      {row.meta.noindex ? "noindex" : "indexable"}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      className={cn(
                        "inline-flex rounded-full border px-2 py-0.5 text-xs",
                        TONE_CLASS[verdict.tone],
                      )}
                    >
                      {verdict.label}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right align-top">
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => setOpenPath(row.path)}
                    >
                      Edit SEO
                    </Button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-sm text-ink-muted">
        Blog posts keep their own SEO fields inside the post editor —{" "}
        <Link href="/seoteam/posts" className="text-biro underline underline-offset-2">
          open Posts
        </Link>{" "}
        to edit those.
      </p>

      {selected && (
        <MetaDrawer
          key={selected.path}
          row={selected}
          onClose={() => setOpenPath(null)}
          onSaved={(meta) => {
            applyRow(selected.path, meta, true);
            toast({ message: `SEO saved for ${selected.path}.`, tone: "success" });
          }}
          onReset={(meta) => {
            applyRow(selected.path, meta, false);
            toast({ message: `${selected.path} reset to defaults.`, tone: "success" });
          }}
        />
      )}
    </>
  );
}

const CHANGE_FREQUENCIES: ChangeFrequency[] = [
  "always",
  "hourly",
  "daily",
  "weekly",
  "monthly",
  "yearly",
  "never",
];

function MetaDrawer({
  row,
  onClose,
  onSaved,
  onReset,
}: {
  row: RouteRow;
  onClose: () => void;
  onSaved: (meta: PageMeta) => void;
  onReset: (meta: PageMeta) => void;
}) {
  const [draft, setDraft] = React.useState<PageMeta>(row.meta);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const patch = (changes: Partial<PageMeta>) =>
    setDraft((prev) => ({ ...prev, ...changes }));

  const jsonLdError = React.useMemo(() => {
    const result = validateJsonLd(draft.customJsonLd);
    return result.ok ? null : result.error;
  }, [draft.customJsonLd]);

  const analysis = analyzePageSeo(draft);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = async () => {
    if (jsonLdError) {
      setError(jsonLdError);
      return;
    }
    setSaving(true);
    setError(null);
    try {
      onSaved(await savePageMeta(draft));
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    setError(null);
    try {
      await resetPageMeta(row.path);
      onReset(row.meta);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not reset.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} aria-hidden="true" />
      <div className="relative z-10 flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-border-subtle bg-paper">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-border-subtle bg-paper px-5 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-ink">{row.label}</h2>
            <p className="truncate text-sm text-ink-muted">{row.path}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Link
              href={row.path}
              target="_blank"
              aria-label="Open page in a new tab"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              <ExternalLink size={17} aria-hidden="true" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="inline-flex h-9 w-9 items-center justify-center rounded-md text-ink-muted hover:bg-surface-sunken hover:text-ink"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-5 px-5 py-5">
          <GoogleSnippetPreview
            path={row.path}
            title={draft.title}
            description={draft.description}
          />

          <TextRow
            label="Title"
            value={draft.title}
            min={50}
            max={60}
            onChange={(title) => patch({ title })}
            helper={
              row.absoluteTitle
                ? "Used verbatim — this route opts out of the “%s · Site name” template."
                : "The site's title template wraps this."
            }
          />
          <TextAreaRow
            label="Meta description"
            value={draft.description}
            min={150}
            max={160}
            onChange={(description) => patch({ description })}
          />
          <StringListEditor
            label="Keywords"
            values={draft.keywords}
            onChange={(keywords) => patch({ keywords })}
          />
          <TextRow
            label="Canonical URL"
            value={draft.canonical}
            placeholder={row.path}
            onChange={(canonical) => patch({ canonical })}
            helper="Leave blank to use this route's own path."
          />

          <div className="border-t border-border-subtle pt-5">
            <h3 className="mb-3 font-display text-sm font-semibold text-ink">
              Social card
            </h3>
            <SocialCardPreview
              path={row.path}
              title={draft.ogTitle || draft.title}
              description={draft.ogDescription || draft.description}
              image={draft.ogImage}
            />
            <div className="mt-4 flex flex-col gap-4">
              <FieldGrid>
                <TextRow
                  label="OG title"
                  value={draft.ogTitle}
                  placeholder={draft.title}
                  onChange={(ogTitle) => patch({ ogTitle })}
                />
                <TextRow
                  label="OG image URL"
                  value={draft.ogImage}
                  onChange={(ogImage) => patch({ ogImage })}
                />
              </FieldGrid>
              <TextAreaRow
                label="OG description"
                value={draft.ogDescription}
                rows={2}
                placeholder={draft.description}
                onChange={(ogDescription) => patch({ ogDescription })}
              />
              <FieldGrid>
                <TextRow
                  label="Twitter title"
                  value={draft.twitterTitle}
                  placeholder={draft.ogTitle || draft.title}
                  onChange={(twitterTitle) => patch({ twitterTitle })}
                />
                <TextRow
                  label="Twitter description"
                  value={draft.twitterDescription}
                  placeholder={draft.ogDescription || draft.description}
                  onChange={(twitterDescription) => patch({ twitterDescription })}
                />
              </FieldGrid>
            </div>
          </div>

          <div className="border-t border-border-subtle pt-5">
            <h3 className="mb-3 font-display text-sm font-semibold text-ink">
              Indexing &amp; sitemap
            </h3>
            <ToggleRow
              label="noindex"
              description="Ask search engines not to index this page."
              checked={draft.noindex}
              onCheckedChange={(noindex) =>
                // Keeping the sitemap in step is the whole point of the
                // "indexing & sitemap agree" check — do it automatically.
                patch({
                  noindex,
                  sitemap: { ...draft.sitemap, exclude: noindex ? true : draft.sitemap.exclude },
                })
              }
            />
            <ToggleRow
              label="nofollow"
              description="Ask search engines not to follow links on this page."
              checked={draft.nofollow}
              onCheckedChange={(nofollow) => patch({ nofollow })}
            />
            <ToggleRow
              label="Exclude from sitemap"
              checked={draft.sitemap.exclude}
              onCheckedChange={(exclude) =>
                patch({ sitemap: { ...draft.sitemap, exclude } })
              }
            />
            <FieldGrid>
              <div>
                <Label htmlFor="change-frequency">Change frequency</Label>
                <Select
                  id="change-frequency"
                  value={draft.sitemap.changeFrequency}
                  onChange={(e) =>
                    patch({
                      sitemap: {
                        ...draft.sitemap,
                        changeFrequency: e.target.value as ChangeFrequency,
                      },
                    })
                  }
                >
                  {CHANGE_FREQUENCIES.map((freq) => (
                    <option key={freq} value={freq}>
                      {freq}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="priority">Priority</Label>
                <Select
                  id="priority"
                  value={String(draft.sitemap.priority)}
                  onChange={(e) =>
                    patch({
                      sitemap: { ...draft.sitemap, priority: Number(e.target.value) },
                    })
                  }
                >
                  {["0", "0.1", "0.3", "0.5", "0.7", "0.8", "0.9", "1"].map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </Select>
              </div>
            </FieldGrid>
          </div>

          <div className="border-t border-border-subtle pt-5">
            <h3 className="mb-1 font-display text-sm font-semibold text-ink">
              Custom JSON-LD
            </h3>
            <p className="mb-2 text-xs text-ink-muted">
              Validated JSON with a supported <code>@type</code>, rendered with escaped
              output. Leave blank for none.
            </p>
            <Textarea
              rows={6}
              value={draft.customJsonLd}
              spellCheck={false}
              className="font-mono text-xs"
              onChange={(e) => patch({ customJsonLd: e.target.value })}
              aria-invalid={!!jsonLdError}
            />
            {jsonLdError && (
              <p className="mt-1.5 text-xs text-danger-fg">{jsonLdError}</p>
            )}
            <p className="mt-2 text-xs text-ink-muted">
              <a
                href={`https://search.google.com/test/rich-results?url=${encodeURIComponent(
                  row.path,
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-biro underline underline-offset-2"
              >
                Open the Rich Results Test
              </a>{" "}
              after publishing.
            </p>
          </div>

          <div className="border-t border-border-subtle pt-5">
            <h3 className="mb-2 font-display text-sm font-semibold text-ink">
              SEO checks
            </h3>
            <ul className="flex flex-col gap-1.5">
              {analysis.checks.map((check) => (
                <li key={check.id} className="flex items-start gap-2 text-sm">
                  <span
                    className={cn(
                      "mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full",
                      check.status === "pass"
                        ? "bg-ok-fg"
                        : check.status === "warn"
                          ? "bg-warn-fg"
                          : "bg-danger-fg",
                    )}
                    aria-hidden="true"
                  />
                  <span>
                    <span className="font-medium text-ink">{check.label}</span>{" "}
                    <span className="text-ink-muted">{check.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border-subtle bg-paper px-5 py-3">
          <div className="min-w-0">
            {error ? (
              <p className="text-sm text-danger-fg">{error}</p>
            ) : row.hasOverride ? (
              <button
                type="button"
                onClick={() => void reset()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 text-sm text-ink-muted transition-colors hover:text-danger-fg"
              >
                <RotateCcw size={14} aria-hidden="true" />
                Reset to default
              </button>
            ) : (
              <p className="text-sm text-ink-muted">No override yet</p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : "Save SEO"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
