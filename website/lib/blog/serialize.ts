import type { PostDoc } from "./models";
import type { Post } from "./types";

/** Map a Mongoose post doc (or a `.lean()` plain object) to public JSON. */
export function serializePost(doc: PostDoc): Post {
  return {
    id: doc._id.toString(),
    title: doc.title,
    slug: doc.slug,
    template: doc.template,
    body: doc.body,
    excerpt: doc.excerpt,
    metaTitle: doc.metaTitle,
    coverImage: doc.coverImage,
    coverImageAlt: doc.coverImageAlt,
    keywords: (doc.keywords ?? []).map((k) => ({
      keyword: k.keyword,
      url: k.url,
      rel: k.rel,
    })),
    linkOccurrences: doc.linkOccurrences,
    status: doc.status,
    author: doc.author,
    views: doc.views,
    createdAt: doc.createdAt ? new Date(doc.createdAt).toISOString() : new Date(0).toISOString(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : new Date(0).toISOString(),
    publishedAt: doc.publishedAt ? new Date(doc.publishedAt).toISOString() : null,
  };
}
