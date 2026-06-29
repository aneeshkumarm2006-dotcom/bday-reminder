"use client";

import { ArrowLeft, Eye, Pencil } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { SeoTeamHeader } from "@/components/seoteam/seoteam-header";
import { SeoCheckList } from "@/components/seoteam/seo-check-list";
import { Button } from "@/components/ui/button";
import { Input, Label, TextField, Textarea } from "@/components/ui/input";
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
  PostStatus,
  TemplateKey,
} from "@/lib/blog/types";
import { cn } from "@/lib/utils";

import { CoverImageField } from "./cover-image-field";
import { KeywordManager } from "./keyword-manager";
import { PostPreview } from "./post-preview";
import { TemplatePicker } from "./template-picker";
import { TiptapEditor } from "./tiptap-editor";

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

export function PostEditor({
  mode,
  initial,
}: {
  mode: "new" | "edit";
  initial?: Post;
}) {
  const router = useRouter();
  const { toast } = useToast();

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
  const [status, setStatus] = useState<PostStatus>(initial?.status ?? "draft");

  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);

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

  const buildPayload = (nextStatus: PostStatus) => {
    const cleanedKeywords = keywords
      .map((k) => ({ ...k, keyword: k.keyword.trim(), url: k.url.trim() }))
      .filter((k) => k.keyword && k.url);
    return {
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
      status: nextStatus,
    };
  };

  const save = async (nextStatus: PostStatus) => {
    if (!title.trim()) {
      toast({ message: "Add a title before saving.", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const payload = buildPayload(nextStatus);
      if (mode === "edit" && initial) {
        const updated = await updatePostRequest(initial.id, payload);
        setStatus(updated.status);
        setSlug(updated.slug);
        toast({
          message:
            nextStatus === "published"
              ? "Saved and published."
              : nextStatus === "draft" && status === "published"
                ? "Unpublished — now a draft."
                : "Draft saved.",
          tone: "success",
        });
        router.refresh();
      } else {
        const created = await createPostRequest(payload);
        toast({
          message:
            nextStatus === "published" ? "Published." : "Draft saved.",
          tone: "success",
        });
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

  const isPublished = status === "published";

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
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                isPublished
                  ? "bg-ok-bg text-ok-fg"
                  : "bg-surface-sunken text-ink-secondary",
              )}
            >
              {isPublished ? "Published" : "Draft"}
            </span>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPreview((p) => !p)}
            >
              {preview ? (
                <>
                  <Pencil size={16} aria-hidden="true" /> Edit
                </>
              ) : (
                <>
                  <Eye size={16} aria-hidden="true" /> Preview
                </>
              )}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => save("draft")}
              disabled={busy}
            >
              {isPublished ? "Unpublish" : "Save draft"}
            </Button>
            <Button size="sm" onClick={() => save("published")} disabled={busy}>
              {isPublished ? "Save changes" : "Publish"}
            </Button>
          </div>
        </div>
      </div>

      <main className="mx-auto w-full max-w-6xl px-5 py-8">
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main column */}
          <div className="flex flex-col gap-5 lg:col-span-2">
            {preview ? (
              <PostPreview
                title={title}
                coverImage={coverImage}
                coverImageAlt={coverImageAlt}
                body={body}
                keywords={keywords}
                linkOccurrences={linkOccurrences}
              />
            ) : (
              <>
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
              </>
            )}
          </div>

          {/* Sidebar */}
          <aside className="flex flex-col gap-6">
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
