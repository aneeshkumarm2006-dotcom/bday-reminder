"use client";

import { Check, ExternalLink, Loader2, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import * as React from "react";

import { BlockForm } from "@/components/seoteam/admin/block-forms";
import { StringListEditor, TextAreaRow, TextRow } from "@/components/seoteam/admin/fields";
import { AdminSection, FieldGrid } from "@/components/seoteam/admin/layout";
import { ListEditor, newId } from "@/components/seoteam/admin/list-editor";
import { MediaPickerField } from "@/components/seoteam/admin/media-picker";
import { SaveBar, useSaveShortcut, useUnsavedGuard } from "@/components/seoteam/admin/save-bar";
import {
  GoogleSnippetPreview,
  SocialCardPreview,
} from "@/components/seoteam/admin/snippet-preview";
import { TypedConfirmDialog } from "@/components/seoteam/admin/typed-confirm";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input, Label } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { ToggleRow } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { slugify } from "@/lib/blog/slug";
import {
  createRedirect,
  createSitePage,
  deleteSitePage,
  savePageMeta,
  updateSitePage,
} from "@/lib/content/admin-api";
import { BLOCK_DEFINITIONS, blockTitle } from "@/lib/content/blocks";
import { iconFor } from "@/lib/content/icons";
import { analyzePageSeo } from "@/lib/content/page-seo";
import { derivePageVisibility, type PageVisibility } from "@/lib/content/schedule";
import type { PageBlock, PageMeta, SitePage } from "@/lib/content/types";
import { cn } from "@/lib/utils";

type Tab = "content" | "seo" | "settings";

export interface PageBuilderProps {
  /** Null for a brand-new page. */
  page: SitePage | null;
  meta: PageMeta;
}

/**
 * The custom page builder: a block list on the left, the selected block's form
 * on the right, plus SEO and Settings tabs.
 *
 * A page's SEO lives in the same `PageMeta` collection every other route uses,
 * so a custom page shows up in `/seoteam/meta` alongside the built-ins rather
 * than in a parallel system.
 */
export function PageBuilder({ page, meta: initialMeta }: PageBuilderProps) {
  const router = useRouter();
  const { toast } = useToast();

  const [id, setId] = React.useState(page?.id ?? null);
  const [tab, setTab] = React.useState<Tab>("content");
  const [title, setTitle] = React.useState(page?.title ?? "");
  const [slug, setSlug] = React.useState(page?.slug ?? "");
  const [blocks, setBlocks] = React.useState<PageBlock[]>(page?.blocks ?? []);
  const [status, setStatus] = React.useState(page?.status ?? "draft");
  const [publishedAt, setPublishedAt] = React.useState(page?.publishedAt ?? null);
  const [showInSitemap, setShowInSitemap] = React.useState(page?.showInSitemap ?? true);
  const [meta, setMeta] = React.useState<PageMeta>(initialMeta);

  const [selectedBlockId, setSelectedBlockId] = React.useState(page?.blocks[0]?.id ?? "");
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [slugState, setSlugState] = React.useState<"idle" | "checking" | "free" | "taken">(
    "idle",
  );
  // Declared before `save`, which sets it after a slug rename.
  const [pendingRedirect, setPendingRedirect] = React.useState<
    { from: string; to: string } | null
  >(null);

  const originalSlug = page?.slug ?? "";
  const effectiveSlug = slug.trim() || slugify(title);
  const visibility: PageVisibility = derivePageVisibility(status, publishedAt);

  const snapshot = React.useMemo(
    () => JSON.stringify({ title, slug, blocks, status, publishedAt, showInSitemap, meta }),
    [title, slug, blocks, status, publishedAt, showInSitemap, meta],
  );
  const [savedSnapshot, setSavedSnapshot] = React.useState(snapshot);
  const dirty = snapshot !== savedSnapshot;
  useUnsavedGuard(dirty);

  // Live slug availability, debounced so typing doesn't hammer the API. The
  // effect body only schedules a timer — every state change happens inside the
  // callback, once the network answers.
  React.useEffect(() => {
    const candidate = effectiveSlug;
    if (!candidate || candidate === originalSlug) return;

    const timer = window.setTimeout(async () => {
      setSlugState("checking");
      try {
        const params = new URLSearchParams({ slug: candidate });
        if (id) params.set("excludeId", id);
        const res = await fetch(`/seoteam/api/pages?${params.toString()}`);
        const data = (await res.json()) as { available?: boolean };
        setSlugState(data.available ? "free" : "taken");
      } catch {
        setSlugState("idle");
      }
    }, 400);
    return () => window.clearTimeout(timer);
  }, [effectiveSlug, originalSlug, id]);

  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) ?? blocks[0] ?? null;

  const patchBlock = (changes: Record<string, unknown>) => {
    if (!selectedBlock) return;
    setBlocks((prev) =>
      prev.map((b) => (b.id === selectedBlock.id ? ({ ...b, ...changes } as PageBlock) : b)),
    );
  };

  const save = React.useCallback(async () => {
    if (!title.trim()) {
      setError("Give the page a title before saving.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title,
        slug: effectiveSlug,
        status,
        publishedAt,
        blocks,
        showInSitemap,
        author: "",
      };
      const savedPage = id
        ? await updateSitePage(id, payload)
        : await createSitePage(payload);

      // The page's SEO row is keyed by its live path, which the server may have
      // de-duplicated — always write against the slug that came back.
      await savePageMeta({ ...meta, path: `/${savedPage.slug}` });

      setId(savedPage.id);
      setSlug(savedPage.slug);
      setPublishedAt(savedPage.publishedAt);
      setMeta((prev) => ({ ...prev, path: `/${savedPage.slug}` }));
      setSavedSnapshot(
        JSON.stringify({
          title,
          slug: savedPage.slug,
          blocks,
          status,
          publishedAt: savedPage.publishedAt,
          showInSitemap,
          meta: { ...meta, path: `/${savedPage.slug}` },
        }),
      );
      toast({ message: "Page saved.", tone: "success" });

      // A renamed slug leaves the old URL dead — offer the redirect right here,
      // while the editor still knows what the old path was.
      if (originalSlug && originalSlug !== savedPage.slug) {
        setPendingRedirect({ from: `/${originalSlug}`, to: `/${savedPage.slug}` });
      }

      if (!page) router.replace(`/seoteam/pages/${savedPage.id}/edit`);
      else router.refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save the page.";
      setError(message);
      toast({ message, tone: "error" });
    } finally {
      setSaving(false);
    }
  }, [
    title,
    effectiveSlug,
    status,
    publishedAt,
    blocks,
    showInSitemap,
    meta,
    id,
    page,
    originalSlug,
    router,
    toast,
  ]);

  useSaveShortcut(() => {
    if (dirty && !saving) void save();
  });

  const remove = async () => {
    if (!id) return;
    setSaving(true);
    try {
      await deleteSitePage(id);
      toast({ message: "Page deleted.", tone: "success" });
      router.replace("/seoteam/pages");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete the page.");
      setSaving(false);
    }
  };

  const analysis = analyzePageSeo(
    { ...meta, title: meta.title || title },
    { hasContent: blocks.length > 0 },
  );

  return (
    <>
      <div className="mb-5 flex flex-wrap items-center gap-2 border-b border-border-subtle">
        {(
          [
            ["content", "Content"],
            ["seo", "SEO"],
            ["settings", "Settings"],
          ] as [Tab, string][]
        ).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            aria-current={tab === key ? "page" : undefined}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              tab === key
                ? "border-biro text-ink"
                : "border-transparent text-ink-secondary hover:text-ink",
            )}
          >
            {label}
            {key === "seo" && analysis.counts.fail > 0 && (
              <span className="ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-bg px-1 text-[10px] text-danger-fg">
                {analysis.counts.fail}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "content" && (
        <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
          <aside className="lg:sticky lg:top-6 lg:self-start">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
              Blocks
            </p>
            <ListEditor
              items={blocks}
              onChange={setBlocks}
              keyFor={(block) => block.id}
              titleFor={(block) => blockTitle(block)}
              subtitleFor={(block) => block.type}
              max={60}
              emptyLabel="No blocks yet — add one to start building."
              renderItem={(block) => (
                <button
                  type="button"
                  onClick={() => setSelectedBlockId(block.id)}
                  className="w-full rounded-md border border-border-strong px-3 py-2 text-sm text-ink transition-colors hover:bg-surface-sunken"
                >
                  Edit this block
                </button>
              )}
            />
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="mt-2 inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border-strong text-sm font-medium text-ink-secondary transition-colors hover:border-biro hover:text-ink"
            >
              <Plus size={16} aria-hidden="true" />
              Add block
            </button>
          </aside>

          <div className="min-w-0">
            {selectedBlock ? (
              <AdminSection
                title={blockTitle(selectedBlock)}
                description={`${selectedBlock.type} block`}
              >
                <BlockForm
                  key={selectedBlock.id}
                  block={selectedBlock}
                  patch={patchBlock}
                  onError={(message) => toast({ message, tone: "error" })}
                />
              </AdminSection>
            ) : (
              <p className="rounded-md border border-dashed border-border-subtle px-4 py-10 text-center text-sm text-ink-muted">
                Add a block to start building this page.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "seo" && (
        <>
          <AdminSection
            title="Search appearance"
            description="How this page looks in Google and when shared."
          >
            <GoogleSnippetPreview
              path={`/${effectiveSlug || "page"}`}
              title={meta.title || title}
              description={meta.description}
            />
            <TextRow
              label="Title"
              value={meta.title}
              min={50}
              max={60}
              placeholder={title}
              onChange={(next) => setMeta({ ...meta, title: next })}
              helper="Leave blank to use the page title."
            />
            <TextAreaRow
              label="Meta description"
              value={meta.description}
              min={150}
              max={160}
              onChange={(description) => setMeta({ ...meta, description })}
            />
            <StringListEditor
              label="Keywords"
              values={meta.keywords}
              onChange={(keywords) => setMeta({ ...meta, keywords })}
            />
            <TextRow
              label="Canonical URL"
              value={meta.canonical}
              placeholder={`/${effectiveSlug}`}
              onChange={(canonical) => setMeta({ ...meta, canonical })}
            />
          </AdminSection>

          <AdminSection title="Social card">
            <SocialCardPreview
              path={`/${effectiveSlug || "page"}`}
              title={meta.ogTitle || meta.title || title}
              description={meta.ogDescription || meta.description}
              image={meta.ogImage}
            />
            <FieldGrid>
              <TextRow
                label="OG title"
                value={meta.ogTitle}
                placeholder={meta.title || title}
                onChange={(ogTitle) => setMeta({ ...meta, ogTitle })}
              />
              <TextRow
                label="OG description"
                value={meta.ogDescription}
                placeholder={meta.description}
                onChange={(ogDescription) => setMeta({ ...meta, ogDescription })}
              />
            </FieldGrid>
            <MediaPickerField
              label="OG image"
              value={meta.ogImage}
              onChange={(ogImage) => setMeta({ ...meta, ogImage })}
            />
          </AdminSection>

          <AdminSection title="Indexing">
            <ToggleRow
              label="noindex"
              description="Ask search engines not to index this page."
              checked={meta.noindex}
              onCheckedChange={(noindex) =>
                setMeta({
                  ...meta,
                  noindex,
                  sitemap: { ...meta.sitemap, exclude: noindex || meta.sitemap.exclude },
                })
              }
            />
            <ToggleRow
              label="nofollow"
              checked={meta.nofollow}
              onCheckedChange={(nofollow) => setMeta({ ...meta, nofollow })}
            />
            <ul className="flex flex-col gap-1.5 pt-2">
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
          </AdminSection>
        </>
      )}

      {tab === "settings" && (
        <>
          <AdminSection title="Page">
            <TextRow label="Title" value={title} onChange={setTitle} />
            <div>
              <Label htmlFor="page-slug">URL slug</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-ink-muted">/</span>
                <Input
                  id="page-slug"
                  value={slug}
                  placeholder={slugify(title) || "page-slug"}
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>
              <p
                className={cn(
                  "mt-1.5 text-xs",
                  slugState === "taken" ? "text-danger-fg" : "text-ink-muted",
                )}
              >
                {slugState === "checking" && "Checking availability…"}
                {slugState === "free" && `/${effectiveSlug} is available.`}
                {slugState === "taken" &&
                  `/${effectiveSlug} is taken or reserved — a suffix will be added on save.`}
                {slugState === "idle" &&
                  "Lowercase letters, numbers, and hyphens. Reserved routes are rejected."}
              </p>
            </div>
          </AdminSection>

          <AdminSection
            title="Visibility"
            description="Scheduling is read-gated at request time, so a page goes live on the minute — no cron, no cache lag."
          >
            <div>
              <Label htmlFor="page-visibility">Status</Label>
              <Select
                id="page-visibility"
                value={visibility}
                onChange={(e) => {
                  const next = e.target.value as PageVisibility;
                  if (next === "draft") {
                    setStatus("draft");
                  } else if (next === "published") {
                    setStatus("published");
                    setPublishedAt(null);
                  } else {
                    setStatus("published");
                    setPublishedAt(
                      publishedAt && new Date(publishedAt) > new Date()
                        ? publishedAt
                        : new Date(Date.now() + 60 * 60 * 1000).toISOString(),
                    );
                  }
                }}
              >
                <option value="draft">Draft — not visible</option>
                <option value="published">Published — visible now</option>
                <option value="scheduled">Scheduled — visible from a set time</option>
              </Select>
            </div>
            {visibility === "scheduled" && (
              <div>
                <Label htmlFor="publish-at">Goes live at</Label>
                <Input
                  id="publish-at"
                  type="datetime-local"
                  value={toLocalInput(publishedAt)}
                  onChange={(e) => {
                    const date = new Date(e.target.value);
                    setPublishedAt(
                      Number.isNaN(date.getTime()) ? null : date.toISOString(),
                    );
                  }}
                />
                <p className="mt-1.5 text-xs text-ink-muted">Your local time.</p>
              </div>
            )}
            <ToggleRow
              label="Include in sitemap.xml"
              checked={showInSitemap}
              onCheckedChange={setShowInSitemap}
            />
          </AdminSection>

          {id && (
            <AdminSection
              title="Danger zone"
              tone="danger"
              description="Deleting a page removes it, its SEO row, and its URL. A revision snapshot is kept in Activity."
            >
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="self-start"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={16} aria-hidden="true" />
                Delete this page
              </Button>
            </AdminSection>
          )}
        </>
      )}

      <SaveBar
        dirty={dirty}
        saving={saving}
        error={error}
        onSave={() => void save()}
        saveLabel={id ? "Save page" : "Create page"}
      >
        {id && (
          <a
            href={`/seoteam/preview/page/${id}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken"
          >
            <ExternalLink size={16} aria-hidden="true" />
            Preview
          </a>
        )}
      </SaveBar>

      {/* ------------------------------ block palette ----------------------- */}
      <Dialog
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        title="Add a block"
        description="Every block reuses the site's own section styling."
        className="sm:max-w-2xl"
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {BLOCK_DEFINITIONS.map((definition) => {
            const Icon = iconFor(definition.icon);
            return (
              <li key={definition.type}>
                <button
                  type="button"
                  onClick={() => {
                    const block = definition.create(newId(definition.type));
                    setBlocks((prev) => [...prev, block]);
                    setSelectedBlockId(block.id);
                    setPaletteOpen(false);
                  }}
                  className="flex w-full gap-3 rounded-lg border border-border-subtle p-3 text-left transition-colors hover:border-biro hover:bg-surface-sunken"
                >
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-biro-tint text-biro">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-ink">
                      {definition.label}
                    </span>
                    <span className="block text-xs text-ink-muted">
                      {definition.description}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </Dialog>

      <TypedConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Delete this page?"
        message="The page and its SEO settings are removed and the URL will 404 (unless you add a redirect first)."
        phrase={effectiveSlug}
        confirmLabel="Delete the page"
        onConfirm={() => void remove()}
      />

      <SlugRedirectPrompt
        pending={pendingRedirect}
        onClose={() => setPendingRedirect(null)}
        onCreated={() => toast({ message: "Redirect created.", tone: "success" })}
      />
    </>
  );
}

/**
 * After a slug rename, offer the 301 that keeps the old URL (and its rankings)
 * working. Declining is fine — it's a prompt, not a requirement.
 */
function SlugRedirectPrompt({
  pending,
  onClose,
  onCreated,
}: {
  pending: { from: string; to: string } | null;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [busy, setBusy] = React.useState(false);

  if (!pending) return null;

  return (
    <Dialog
      open
      onClose={onClose}
      title="Redirect the old URL?"
      description={`${pending.from} no longer resolves. A 301 sends its visitors and its search ranking to ${pending.to}.`}
    >
      <div className="mt-2 flex justify-end gap-3">
        <Button type="button" variant="secondary" onClick={onClose}>
          <X size={16} aria-hidden="true" />
          No thanks
        </Button>
        <Button
          type="button"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await createRedirect({
                from: pending.from,
                to: pending.to,
                type: 301,
                enabled: true,
                note: "Created automatically after a slug rename.",
              });
              onCreated();
            } finally {
              setBusy(false);
              onClose();
            }
          }}
        >
          {busy ? (
            <Loader2 size={16} className="animate-spin" aria-hidden="true" />
          ) : (
            <Check size={16} aria-hidden="true" />
          )}
          Create the 301
        </Button>
      </div>
    </Dialog>
  );
}

/** ISO → the "YYYY-MM-DDTHH:mm" a `datetime-local` input expects, in local time. */
function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}
