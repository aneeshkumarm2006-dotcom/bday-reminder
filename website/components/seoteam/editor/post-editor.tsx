"use client";

import { ArrowLeft, Eye, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { SeoCheckList } from "@/components/seoteam/seo-check-list";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useConfirm } from "@/components/ui/confirm-dialog";
import { Input, Label, TextField, Textarea } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  createPostRequest,
  fileToDataUri,
  updatePostRequest,
  uploadImageRequest,
} from "@/lib/blog/dashboard-api";
import { analyzeSeo } from "@/lib/blog/seo-checks";
import { slugify } from "@/lib/blog/slug";
import { getTemplate } from "@/lib/blog/templates";
import type {
  Keyword,
  LinkOccurrences,
  Post,
  TemplateKey,
} from "@/lib/blog/types";
import { deriveVisibility, type Visibility } from "@/lib/blog/visibility";
import { cn } from "@/lib/utils";

import { CoverImageField } from "./cover-image-field";
import { KeywordManager } from "./keyword-manager";
import { PostPreview } from "./post-preview";
import { SearchListingPreview } from "./search-listing-preview";
import { TemplatePicker } from "./template-picker";
import { TiptapEditor } from "./tiptap-editor";
import { VisibilityCard } from "./visibility-card";

function CharCount({
  value,
  min,
  max,
}: {
  value: string;
  min: number;
  max: number;
}) {
  const len = value.trim().length;
  const tone =
    len >= min && len <= max
      ? "text-ok-fg"
      : len === 0
        ? "text-ink-muted"
        : "text-snz-fg";
  return (
    <span className={cn("text-xs tabular-nums", tone)}>
      {len} / {min}–{max}
    </span>
  );
}

const VIS_META: Record<Visibility, { label: string; tone: string }> = {
  draft: { label: "Draft", tone: "neutral" },
  visible: { label: "Visible", tone: "ok" },
  scheduled: { label: "Scheduled", tone: "snooze" },
};

export function PostEditor({
  mode,
  initial,
  initialVisibility,
}: {
  mode: "new" | "edit";
  initial?: Post;
  /** Derived server-side so the client doesn't need `new Date()` at first render. */
  initialVisibility?: Visibility;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const confirm = useConfirm();

  const [template, setTemplate] = useState<TemplateKey | null>(
    initial?.template ?? null,
  );
  const [title, setTitle] = useState(initial?.title ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(initial?.slug));
  const [metaTitle, setMetaTitle] = useState(initial?.metaTitle ?? "");
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? "");
  const [author, setAuthor] = useState(initial?.author ?? "");
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? "");
  const [coverImageAlt, setCoverImageAlt] = useState(
    initial?.coverImageAlt ?? "",
  );
  const [body, setBody] = useState(initial?.body ?? "");
  const [keywords, setKeywords] = useState<Keyword[]>(initial?.keywords ?? []);
  const [linkOccurrences, setLinkOccurrences] = useState<LinkOccurrences>(
    initial?.linkOccurrences ?? "first",
  );
  const [visibility, setVisibility] = useState<Visibility>(
    initialVisibility ?? (initial?.status === "published" ? "visible" : "draft"),
  );
  const [publishedAt, setPublishedAt] = useState<string>(
    initial?.publishedAt ?? "",
  );

  const [tab, setTab] = useState<"edit" | "preview">("edit");
  const [busy, setBusy] = useState(false);

  // ── Unsaved-changes guard ─────────────────────────────────────────────────
  // A fingerprint of every editable field. When it drifts from the last-saved
  // baseline the form is "dirty" and we warn before the user navigates away —
  // people kept losing edits by leaving the editor without hitting the button.
  const snapshot = useMemo(
    () =>
      JSON.stringify({
        template,
        title,
        slug,
        metaTitle,
        excerpt,
        author,
        coverImage,
        coverImageAlt,
        body,
        keywords,
        linkOccurrences,
        visibility,
        publishedAt,
      }),
    [
      template,
      title,
      slug,
      metaTitle,
      excerpt,
      author,
      coverImage,
      coverImageAlt,
      body,
      keywords,
      linkOccurrences,
      visibility,
      publishedAt,
    ],
  );
  const [baseline, setBaseline] = useState(snapshot);
  const [justSaved, setJustSaved] = useState(false);
  const dirty = snapshot !== baseline;

  // After a successful save, state settles to the server's response on the next
  // render; re-baseline from the fresh snapshot then so `dirty` resets to false.
  useEffect(() => {
    if (justSaved) {
      setBaseline(snapshot);
      setJustSaved(false);
    }
  }, [justSaved, snapshot]);

  const confirmLeave = useCallback(
    async (dest: string) => {
      const ok = await confirm({
        title: "Leave without saving?",
        message:
          "You have unsaved changes. If you leave now they'll be lost — save your draft or publish first.",
        confirmLabel: "Leave and discard",
        cancelLabel: "Keep editing",
        destructive: true,
      });
      if (ok) router.push(dest);
    },
    [confirm, router],
  );

  // Warn on any exit while there are unsaved edits: hard navigations / refresh /
  // tab close via `beforeunload`, and in-app link clicks (the Posts back links,
  // the header logo, Media, etc.) via a capture-phase interceptor that stops the
  // click before Next's <Link> handles it and routes it through our confirm.
  useEffect(() => {
    if (!dirty) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);

    const onClickCapture = (event: MouseEvent) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const anchor = (event.target as HTMLElement | null)?.closest("a");
      const href = anchor?.getAttribute("href");
      if (!anchor || !href) return;
      // Opening in a new tab or downloading doesn't discard the current form.
      if (anchor.target && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;

      const url = new URL(href, window.location.href);
      if (url.origin !== window.location.origin) return; // external link
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return; // same page (e.g. a hash anchor)
      }

      event.preventDefault();
      event.stopPropagation();
      void confirmLeave(url.pathname + url.search + url.hash);
    };
    document.addEventListener("click", onClickCapture, true);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClickCapture, true);
    };
  }, [dirty, confirmLeave]);

  const effectiveMetaTitle = metaTitle.trim() || title;

  const analysis = useMemo(
    () =>
      analyzeSeo({
        metaTitle: effectiveMetaTitle,
        excerpt,
        body,
        keywords,
        coverImage,
      }),
    [effectiveMetaTitle, excerpt, body, keywords, coverImage],
  );

  const pickTemplate = (key: TemplateKey) => {
    setTemplate(key);
    setBody(getTemplate(key).body);
  };

  const onTitleChange = (value: string) => {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  };

  // Don't run the full slugify on every keystroke — that strips a trailing hyphen
  // the instant it's typed, making manual multi-word slugs impossible. Allow
  // in-progress hyphens here and finalize with slugify() on blur.
  const onSlugChange = (raw: string) => {
    setSlugTouched(true);
    setSlug(
      raw
        .toLowerCase()
        .replace(/\s+/g, "-")
        .replace(/[^a-z0-9-]/g, "")
        .replace(/-{2,}/g, "-"),
    );
  };
  const onSlugBlur = () => setSlug((current) => slugify(current));

  const buildPayload = () => {
    const cleanedKeywords = keywords
      .map((k) => ({ ...k, keyword: k.keyword.trim(), url: k.url.trim() }))
      .filter((k) => k.keyword && k.url);
    const base = {
      title: title.trim(),
      ...(slug.trim() ? { slug: slug.trim() } : {}),
      template: (template ?? "generic") as TemplateKey,
      body,
      excerpt: excerpt.trim(),
      metaTitle: metaTitle.trim(),
      coverImage,
      coverImageAlt: coverImageAlt.trim(),
      keywords: cleanedKeywords,
      linkOccurrences,
      author: author.trim(),
    };
    if (visibility === "draft") {
      return { ...base, status: "draft" as const };
    }
    return {
      ...base,
      status: "published" as const,
      // Visible → null = "publish/keep visible now"; Scheduled → the future ISO.
      publishedAt: visibility === "scheduled" ? publishedAt || null : null,
    };
  };

  const savedMessage = () =>
    visibility === "draft"
      ? "Draft saved."
      : visibility === "scheduled"
        ? "Scheduled."
        : mode === "edit" && initial?.status === "published"
          ? "Saved."
          : "Published.";

  const save = async () => {
    if (!title.trim()) {
      toast({ message: "Add a title before saving.", tone: "error" });
      return;
    }
    if (visibility === "scheduled" && !publishedAt) {
      toast({ message: "Pick a publish date, or choose Visible.", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const payload = buildPayload();
      if (mode === "edit" && initial) {
        const updated = await updatePostRequest(initial.id, payload);
        setSlug(updated.slug);
        setPublishedAt(updated.publishedAt ?? "");
        setVisibility(deriveVisibility(updated.status, updated.publishedAt));
        setJustSaved(true);
        toast({ message: savedMessage(), tone: "success" });
        router.refresh();
      } else {
        const created = await createPostRequest(payload);
        // Navigating to the edit page unmounts this form, so no re-baseline needed.
        toast({ message: savedMessage(), tone: "success" });
        router.replace(`/seoteam/posts/${created.id}/edit`);
      }
    } catch (err) {
      toast({
        message: err instanceof Error ? err.message : "Couldn't save the post.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  const saveLabel =
    visibility === "draft"
      ? "Save draft"
      : visibility === "scheduled"
        ? "Schedule"
        : mode === "edit" && initial?.status === "published"
          ? "Save changes"
          : "Publish";

  // ── Template picker step (new posts only) ─────────────────────────────────
  if (mode === "new" && !template) {
    return (
      <>
        <SeoTeamHeader showNewButton={false} />
        <main className="mx-auto w-full max-w-5xl px-5 py-8">
          <Link
            href="/seoteam"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Back to posts
          </Link>
          <TemplatePicker onSelect={pickTemplate} />
        </main>
      </>
    );
  }

  const vis = VIS_META[visibility];

  return (
    <>
      <SeoTeamHeader showNewButton={false} />

      {/* Sticky action bar */}
      <div className="sticky top-0 z-10 border-b border-border-subtle bg-paper/90 backdrop-blur">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-3">
          <Link
            href="/seoteam"
            className="inline-flex items-center gap-1.5 text-sm text-ink-muted hover:text-ink"
          >
            <ArrowLeft size={16} aria-hidden="true" /> Posts
          </Link>
          <div className="flex flex-wrap items-center gap-2">
            {dirty && (
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-snz-fg">
                <span
                  className="h-2 w-2 rounded-full bg-snz-fg"
                  aria-hidden="true"
                />
                Unsaved changes
              </span>
            )}
            <Badge tone={vis.tone}>{vis.label}</Badge>
            {mode === "edit" && initial && (
              <a
                href={`/seoteam/preview/${initial.id}`}
                target="_blank"
                rel="noreferrer"
                className={buttonVariants({ variant: "secondary", size: "sm" })}
              >
                <Eye size={16} aria-hidden="true" /> Preview
              </a>
            )}
            <Button size="sm" onClick={save} disabled={busy}>
              {saveLabel}
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-5 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main column */}
          <div className="flex flex-col gap-5 lg:col-span-2">
            <Tabs value={tab} onValueChange={(v) => setTab(v as "edit" | "preview")}>
              <TabsList aria-label="Editor view" className="mb-4">
                <TabsTrigger value="edit">
                  <Pencil size={15} aria-hidden="true" /> Edit
                </TabsTrigger>
                <TabsTrigger value="preview">
                  <Eye size={15} aria-hidden="true" /> Preview
                </TabsTrigger>
              </TabsList>

              <TabsContent value="edit" className="flex flex-col gap-5">
                <div>
                  <Label htmlFor="post-title">Title</Label>
                  <Input
                    id="post-title"
                    placeholder="Your post title"
                    value={title}
                    onChange={(e) => onTitleChange(e.target.value)}
                    className="text-xl font-display font-semibold"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="post-slug">URL slug</Label>
                    <span className="text-xs text-ink-muted">/blog/{slug || "…"}</span>
                  </div>
                  <Input
                    id="post-slug"
                    placeholder="url-slug"
                    value={slug}
                    onChange={(e) => onSlugChange(e.target.value)}
                    onBlur={onSlugBlur}
                  />
                </div>

                <div>
                  <Label>Content</Label>
                  <TiptapEditor
                    initialContent={body}
                    onChange={setBody}
                    onUploadImage={async (file) => {
                      const dataUri = await fileToDataUri(file);
                      return uploadImageRequest(dataUri);
                    }}
                    onError={(message) => toast({ message, tone: "error" })}
                  />
                </div>
              </TabsContent>

              <TabsContent value="preview">
                <PostPreview
                  title={title}
                  author={author}
                  publishedAt={publishedAt}
                  coverImage={coverImage}
                  coverImageAlt={coverImageAlt}
                  body={body}
                  keywords={keywords}
                  linkOccurrences={linkOccurrences}
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-6">
            <section className="rounded-lg border border-border-subtle bg-surface p-5">
              <h2 className="mb-3 font-display text-base font-semibold text-ink">
                Visibility
              </h2>
              <VisibilityCard
                visibility={visibility}
                onVisibilityChange={setVisibility}
                publishedAt={publishedAt}
                onPublishedAtChange={setPublishedAt}
              />
            </section>

            <section className="rounded-lg border border-border-subtle bg-surface p-5">
              <h2 className="mb-3 font-display text-base font-semibold text-ink">
                SEO checks
              </h2>
              <SeoCheckList analysis={analysis} />
            </section>

            <section className="rounded-lg border border-border-subtle bg-surface p-5">
              <h2 className="mb-3 font-display text-base font-semibold text-ink">
                Search appearance
              </h2>
              <div className="flex flex-col gap-4">
                <SearchListingPreview
                  title={title}
                  metaTitle={metaTitle}
                  excerpt={excerpt}
                  slug={slug}
                />
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="meta-title">Meta title</Label>
                    <CharCount value={effectiveMetaTitle} min={50} max={60} />
                  </div>
                  <Input
                    id="meta-title"
                    placeholder={title || "Defaults to the title"}
                    value={metaTitle}
                    onChange={(e) => setMetaTitle(e.target.value)}
                  />
                </div>
                <div>
                  <div className="flex items-center justify-between">
                    <Label htmlFor="excerpt">Meta description / excerpt</Label>
                    <CharCount value={excerpt} min={150} max={160} />
                  </div>
                  <Textarea
                    id="excerpt"
                    placeholder="A 1–2 sentence summary used as the meta description."
                    value={excerpt}
                    onChange={(e) => setExcerpt(e.target.value)}
                  />
                </div>
              </div>
            </section>

            <section className="rounded-lg border border-border-subtle bg-surface p-5">
              <h2 className="mb-3 font-display text-base font-semibold text-ink">
                Cover image
              </h2>
              <CoverImageField
                coverImage={coverImage}
                coverImageAlt={coverImageAlt}
                onChange={({ coverImage: ci, coverImageAlt: alt }) => {
                  setCoverImage(ci);
                  setCoverImageAlt(alt);
                }}
                onError={(message) => toast({ message, tone: "error" })}
              />
            </section>

            <section className="rounded-lg border border-border-subtle bg-surface p-5">
              <h2 className="mb-1 font-display text-base font-semibold text-ink">
                Keyword backlinks
              </h2>
              <p className="mb-3 text-xs text-ink-muted">
                Occurrences of each keyword in the body become a link to its URL.
              </p>
              <KeywordManager
                keywords={keywords}
                onChange={setKeywords}
                linkOccurrences={linkOccurrences}
                onLinkOccurrencesChange={setLinkOccurrences}
              />
            </section>

            <section className="rounded-lg border border-border-subtle bg-surface p-5">
              <h2 className="mb-3 font-display text-base font-semibold text-ink">
                Details
              </h2>
              <TextField
                label="Author (optional)"
                value={author}
                onChange={(e) => setAuthor(e.target.value)}
                placeholder="e.g. The Circle the date team"
              />
            </section>
          </aside>
        </div>
      </main>
    </>
  );
}
