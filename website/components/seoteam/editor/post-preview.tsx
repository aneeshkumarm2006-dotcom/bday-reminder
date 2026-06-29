"use client";

import { linkifyKeywords } from "@/lib/blog/keyword-links";
import type { Keyword, LinkOccurrences } from "@/lib/blog/types";

/**
 * Live preview of how a post will read, with keyword backlinks applied. Note:
 * the public page additionally sanitizes the HTML on the server — this preview
 * renders the editor's already-clean HTML directly (sanitize-html is kept off
 * the client bundle).
 */
export function PostPreview({
  title,
  coverImage,
  coverImageAlt,
  body,
  keywords,
  linkOccurrences,
}: {
  title: string;
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
    </div>
  );
}
