"use client";

import { ExternalLink } from "lucide-react";
import * as React from "react";

import { BlockListEditor } from "@/components/seoteam/admin/block-list-editor";
import { TextAreaRow, TextRow } from "@/components/seoteam/admin/fields";
import { IconPicker } from "@/components/seoteam/admin/icon-picker";
import { AdminSection, FieldGrid } from "@/components/seoteam/admin/layout";
import {
  SaveBar,
  useSaveShortcut,
  useUnsavedGuard,
} from "@/components/seoteam/admin/save-bar";
import { ToggleRow } from "@/components/ui/switch";
import { useToast } from "@/components/ui/toast";
import { saveBuiltInPages } from "@/lib/content/admin-api";
import { DEFAULT_BUILT_IN_PAGES } from "@/lib/content/defaults";
import type { BuiltInPageKey, BuiltInPages, CtaLink } from "@/lib/content/types";
import { cn } from "@/lib/utils";

/**
 * The four routes the page builder can't reach, because their body is generated
 * rather than authored: the blog index, a post page's furniture, the 404, and
 * the contact page's extras.
 *
 * Each screen pairs the page's typed copy with block lists, so the words *and*
 * anything else — an image, a notice, a call to action, custom HTML — are
 * editable on a page that is otherwise a database query. A blank field falls
 * back to `lib/content/defaults.ts`, exactly like every other editor here.
 *
 * No draft/published split: these are short strings on pages that are dynamic
 * or read-gated anyway, so a staging variant would be ceremony. Every save
 * still snapshots a revision, which is what "undo" actually needs.
 */
const TABS: { key: BuiltInPageKey; label: string; hint: string; preview: string }[] = [
  { key: "blogIndex", label: "Blog index", hint: "/blog — heading, intro, empty states", preview: "/blog" },
  { key: "blogPost", label: "Blog post", hint: "The furniture around every article", preview: "/blog" },
  { key: "notFound", label: "404 page", hint: "What a dead link lands on", preview: "/this-page-does-not-exist" },
  { key: "contact", label: "Contact extras", hint: "The email card and the guidance below it", preview: "/contact" },
];

export function BuiltInEditor({ initial }: { initial: BuiltInPages }) {
  const { toast } = useToast();
  const [saved, setSaved] = React.useState(initial);
  const [draft, setDraft] = React.useState(initial);
  const [tab, setTab] = React.useState<BuiltInPageKey>("blogIndex");
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const dirty = React.useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );
  useUnsavedGuard(dirty);

  const patch = <K extends BuiltInPageKey>(key: K, changes: Partial<BuiltInPages[K]>) =>
    setDraft((prev) => ({ ...prev, [key]: { ...prev[key], ...changes } }));

  const save = React.useCallback(async () => {
    setSaving(true);
    setError(null);
    try {
      const next = await saveBuiltInPages(draft);
      setSaved(next);
      setDraft(next);
      toast({ message: "Built-in pages saved.", tone: "success" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Could not save.";
      setError(message);
      toast({ message, tone: "error" });
    } finally {
      setSaving(false);
    }
  }, [draft, toast]);

  useSaveShortcut(() => {
    if (dirty && !saving) void save();
  });

  const active = TABS.find((entry) => entry.key === tab) ?? TABS[0];

  return (
    <div className="grid gap-6 lg:grid-cols-[16rem_1fr]">
      <aside className="lg:sticky lg:top-6 lg:self-start">
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Pages
        </p>
        <ul className="flex flex-col gap-1">
          {TABS.map((entry) => (
            <li key={entry.key}>
              <button
                type="button"
                onClick={() => setTab(entry.key)}
                aria-current={tab === entry.key ? "true" : undefined}
                className={cn(
                  "w-full rounded-md border px-2.5 py-2 text-left transition-colors",
                  tab === entry.key
                    ? "border-biro bg-biro-tint"
                    : "border-transparent hover:bg-surface-sunken",
                )}
              >
                <span className="block truncate text-sm text-ink">{entry.label}</span>
                <span className="block truncate text-xs text-ink-muted">{entry.hint}</span>
              </button>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-ink-muted">
          These four routes build their own body, so they can&apos;t live in Pages —
          but their words and their extra blocks are editable here.
        </p>
      </aside>

      <div className="min-w-0">
        <AdminSection title={active.label} description={active.hint}>
          {tab === "blogIndex" && (
            <BlogIndexForm
              value={draft.blogIndex}
              patch={(changes) => patch("blogIndex", changes)}
              onError={setError}
            />
          )}
          {tab === "blogPost" && (
            <BlogPostForm
              value={draft.blogPost}
              patch={(changes) => patch("blogPost", changes)}
              onError={setError}
            />
          )}
          {tab === "notFound" && (
            <NotFoundForm
              value={draft.notFound}
              patch={(changes) => patch("notFound", changes)}
              onError={setError}
            />
          )}
          {tab === "contact" && (
            <ContactForm
              value={draft.contact}
              patch={(changes) => patch("contact", changes)}
              onError={setError}
            />
          )}
        </AdminSection>

        <SaveBar
          dirty={dirty}
          saving={saving}
          error={error}
          onSave={() => void save()}
          onReset={() => {
            setDraft(saved);
            setError(null);
          }}
        >
          <a
            href={active.preview}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border-strong bg-surface px-3.5 text-sm font-medium text-ink transition-colors hover:bg-surface-sunken"
          >
            <ExternalLink size={16} aria-hidden="true" />
            View live
          </a>
        </SaveBar>
      </div>
    </div>
  );
}

/* --------------------------------- forms ---------------------------------- */

function BlogIndexForm({
  value,
  patch,
  onError,
}: {
  value: BuiltInPages["blogIndex"];
  patch: (changes: Partial<BuiltInPages["blogIndex"]>) => void;
  onError: (message: string) => void;
}) {
  const defaults = DEFAULT_BUILT_IN_PAGES.blogIndex;
  return (
    <>
      <TextRow
        label="Heading"
        value={value.heading}
        defaultHint={defaults.heading}
        onChange={(heading) => patch({ heading })}
      />
      <TextAreaRow
        label="Intro"
        value={value.intro}
        rows={3}
        onChange={(intro) => patch({ intro })}
        helper="The paragraph under the meta description. The description itself is on the Meta screen."
      />
      <FieldGrid>
        <TextRow
          label="Empty state"
          value={value.emptyText}
          defaultHint={defaults.emptyText}
          onChange={(emptyText) => patch({ emptyText })}
          helper="Shown when there are no published posts."
        />
        <TextRow
          label="Error state"
          value={value.errorText}
          defaultHint={defaults.errorText}
          onChange={(errorText) => patch({ errorText })}
          helper="Shown if the blog can't be read."
        />
      </FieldGrid>

      <fieldset className="rounded-md border border-border-subtle p-3">
        <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
          Guides strip
        </legend>
        <ToggleRow
          label="Link the landing pages"
          description="The list of keyword guides under the post grid — the only place the cluster is linked from the blog."
          checked={value.showGuides}
          onCheckedChange={(showGuides) => patch({ showGuides })}
        />
        <TextRow
          label="Heading"
          value={value.guidesHeading}
          defaultHint={defaults.guidesHeading}
          onChange={(guidesHeading) => patch({ guidesHeading })}
        />
        <TextRow
          label="Sub-heading"
          value={value.guidesSub}
          defaultHint={defaults.guidesSub}
          onChange={(guidesSub) => patch({ guidesSub })}
          helper="{count} is replaced with the number of guides."
        />
      </fieldset>

      <BlockListEditor
        label="Blocks above the posts"
        blocks={value.blocksBefore}
        onChange={(blocksBefore) => patch({ blocksBefore })}
        onError={onError}
        max={20}
      />
      <BlockListEditor
        label="Blocks below the posts"
        blocks={value.blocksAfter}
        onChange={(blocksAfter) => patch({ blocksAfter })}
        onError={onError}
        max={20}
      />
    </>
  );
}

function BlogPostForm({
  value,
  patch,
  onError,
}: {
  value: BuiltInPages["blogPost"];
  patch: (changes: Partial<BuiltInPages["blogPost"]>) => void;
  onError: (message: string) => void;
}) {
  const defaults = DEFAULT_BUILT_IN_PAGES.blogPost;
  return (
    <>
      <p className="rounded-md border border-border-subtle bg-surface-sunken/50 p-3 text-xs text-ink-muted">
        This is the furniture around <em>every</em> article — the post bodies themselves
        live in Posts.
      </p>
      <ToggleRow
        label="Show related posts"
        description="Post-to-post links at the foot of an article. Turning this off leaves older posts one link deep."
        checked={value.showRelated}
        onCheckedChange={(showRelated) => patch({ showRelated })}
      />
      <FieldGrid>
        <TextRow
          label="Related heading"
          value={value.relatedHeading}
          defaultHint={defaults.relatedHeading}
          onChange={(relatedHeading) => patch({ relatedHeading })}
        />
        <TextRow
          label="“All posts” link"
          value={value.allPostsLabel}
          defaultHint={defaults.allPostsLabel}
          onChange={(allPostsLabel) => patch({ allPostsLabel })}
        />
      </FieldGrid>
      <FieldGrid>
        <TextRow
          label="Breadcrumb: home"
          value={value.breadcrumbHome}
          defaultHint={defaults.breadcrumbHome}
          onChange={(breadcrumbHome) => patch({ breadcrumbHome })}
        />
        <TextRow
          label="Breadcrumb: blog"
          value={value.breadcrumbBlog}
          defaultHint={defaults.breadcrumbBlog}
          onChange={(breadcrumbBlog) => patch({ breadcrumbBlog })}
        />
      </FieldGrid>
      <TextRow
        label="Reading-time label"
        value={value.readingTimeLabel}
        defaultHint={defaults.readingTimeLabel}
        onChange={(readingTimeLabel) => patch({ readingTimeLabel })}
        helper="Follows the estimate, e.g. “4 min read”."
      />
      <BlockListEditor
        label="Blocks under every post"
        blocks={value.blocksAfter}
        onChange={(blocksAfter) => patch({ blocksAfter })}
        onError={onError}
        max={20}
        emptyLabel="Nothing yet. A newsletter callout or a CTA here appears under every article."
      />
    </>
  );
}

function NotFoundForm({
  value,
  patch,
  onError,
}: {
  value: BuiltInPages["notFound"];
  patch: (changes: Partial<BuiltInPages["notFound"]>) => void;
  onError: (message: string) => void;
}) {
  const defaults = DEFAULT_BUILT_IN_PAGES.notFound;
  return (
    <>
      <p className="rounded-md border border-border-subtle bg-surface-sunken/50 p-3 text-xs text-ink-muted">
        A renamed URL is better fixed with a redirect than explained on this page — see
        the Redirects screen, which also lists what people are actually hitting.
      </p>
      <FieldGrid>
        <TextRow
          label="Eyebrow"
          value={value.eyebrow}
          defaultHint={defaults.eyebrow}
          onChange={(eyebrow) => patch({ eyebrow })}
        />
        <TextRow
          label="Heading"
          value={value.heading}
          defaultHint={defaults.heading}
          onChange={(heading) => patch({ heading })}
        />
      </FieldGrid>
      <TextAreaRow
        label="Body"
        value={value.body}
        rows={3}
        onChange={(body) => patch({ body })}
      />
      <CtaFields
        legend="Primary button"
        value={value.primaryCta}
        onChange={(primaryCta) => patch({ primaryCta })}
      />
      <CtaFields
        legend="Secondary button"
        value={value.secondaryCta}
        onChange={(secondaryCta) => patch({ secondaryCta })}
      />
      <BlockListEditor
        label="Blocks under the message"
        blocks={value.blocksAfter}
        onChange={(blocksAfter) => patch({ blocksAfter })}
        onError={onError}
        max={20}
      />
    </>
  );
}

function ContactForm({
  value,
  patch,
  onError,
}: {
  value: BuiltInPages["contact"];
  patch: (changes: Partial<BuiltInPages["contact"]>) => void;
  onError: (message: string) => void;
}) {
  const defaults = DEFAULT_BUILT_IN_PAGES.contact;
  return (
    <>
      <p className="rounded-md border border-border-subtle bg-surface-sunken/50 p-3 text-xs text-ink-muted">
        The page&apos;s title, intro and main copy are on the Legal screen; the address
        itself comes from Site settings, so it&apos;s stated in one place.
      </p>
      <ToggleRow
        label="Show the email card"
        checked={value.cardEnabled}
        onCheckedChange={(cardEnabled) => patch({ cardEnabled })}
      />
      <IconPicker value={value.cardIcon} onChange={(cardIcon) => patch({ cardIcon })} />
      <TextRow
        label="Card heading"
        value={value.cardHeading}
        defaultHint={defaults.cardHeading}
        onChange={(cardHeading) => patch({ cardHeading })}
      />
      <TextRow
        label="Card body"
        value={value.cardBody}
        defaultHint={defaults.cardBody}
        onChange={(cardBody) => patch({ cardBody })}
      />
      <BlockListEditor
        label="Blocks under the card"
        blocks={value.blocksAfter}
        onChange={(blocksAfter) => patch({ blocksAfter })}
        onError={onError}
        max={20}
        emptyLabel="Nothing here. The guidance that ships with the page is an HTML block — add one to bring it back."
      />
    </>
  );
}

function CtaFields({
  legend,
  value,
  onChange,
}: {
  legend: string;
  value: CtaLink;
  onChange: (next: CtaLink) => void;
}) {
  return (
    <fieldset className="rounded-md border border-border-subtle p-3">
      <legend className="px-1 text-xs font-medium uppercase tracking-wide text-ink-muted">
        {legend}
      </legend>
      <FieldGrid>
        <TextRow
          label="Label"
          value={value.label}
          onChange={(label) => onChange({ ...value, label })}
          helper="Leave blank to hide this button."
        />
        <TextRow
          label="Link"
          value={value.href}
          onChange={(href) => onChange({ ...value, href })}
        />
      </FieldGrid>
    </fieldset>
  );
}
