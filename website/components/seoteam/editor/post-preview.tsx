"use client";

import { formatDate } from "@/lib/blog/format";
import { linkifyKeywords } from "@/lib/blog/keyword-links";
import type { Keyword, LinkOccurrences } from "@/lib/blog/types";

/** Lightweight reading-time estimate (no node-html-parser in the client bundle). */
function estimateMinutes(html: string): number {
  const words = (html || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean).length;
  return Math.max(1, Math.round(words / 220));
}

/**
 * Live preview mirroring the public article: title, an author · date · reading
 * time meta row, cover, then the body with keyword backlinks applied. The public
 * page additionally sanitizes the HTML on the server at save — this renders the
 * editor's current HTML directly (sanitize-html stays off the client bundle).
 */
export function PostPreview({
  title,
  author,
  publishedAt,
  coverImage,
  coverImageAlt,
  body,
  keywords,
  linkOccurrences,
}: {
  title: string;
  author: string;
  publishedAt: string; // ISO or ""
  coverImage: string;
  coverImageAlt: string;
  body: string;
  keywords: Keyword[];
  linkOccurrences: LinkOccurrences;
}) {
  const html = linkifyKeywords(body, keywords, linkOccurrences);
  return (
    <div className="rounded-lg border border-border-subtle bg-surface p-6 sm:p-8">
      <h1 className="font-display text-3xl font-semibold leading-tight text-ink">
        {title || "Untitled post"}
      </h1>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-ink-muted">
        {author && (
          <>
            <span>{author}</span>
            <span aria-hidden="true">·</span>
          </>
        )}
        <span>{publishedAt ? formatDate(publishedAt) : "Not yet published"}</span>
        <span aria-hidden="true">·</span>
        <span>{estimateMinutes(body)} min read</span>
      </div>

      {coverImage && (
        // eslint-disable-next-line @next/next/no-img-element -- arbitrary remote/data URLs
        <img
          src={coverImage}
          alt={coverImageAlt || title}
          className="mt-5 w-full rounded-lg"
        />
      )}
      <div
        className="prose-blog mt-6"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <p className="mt-6 border-t border-border-subtle pt-3 text-xs text-ink-muted">
        Keyword backlinks appear here as they will on the live post. The final HTML
        is sanitized on the server when you save.
      </p>
    </div>
  );
}
