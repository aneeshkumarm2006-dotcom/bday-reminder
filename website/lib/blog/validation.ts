import { z } from "zod";

import type { ZodError } from "zod";

/** http(s) URL validator that doesn't depend on zod's version-variable `.url()`. */
const httpUrl = z
  .string()
  .trim()
  .refine(
    (v) => {
      try {
        const u = new URL(v);
        return u.protocol === "http:" || u.protocol === "https:";
      } catch {
        return false;
      }
    },
    { message: "Enter a valid http(s) URL." },
  );

/**
 * Publish date. A parseable date string, or `null` to mean "publish/keep visible
 * now". Hand-rolled (like `httpUrl` below) to avoid zod's version-variable
 * `.datetime()`. `.nullable()` matters: the update route uses an explicit `null`
 * as the "make visible now" signal, so it must survive parsing.
 */
const publishedAtSchema = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), { message: "Enter a valid date." })
  .nullable();

/** Cover/inline image URL: empty, an http(s) URL, or a data: image URI. */
const imageUrl = z
  .string()
  .trim()
  .refine(
    (v) =>
      v === "" ||
      /^https?:\/\//i.test(v) ||
      /^data:image\/[a-z0-9.+-]+;base64,/i.test(v),
    { message: "Image must be an http(s) or data URL." },
  );

export const keywordSchema = z.object({
  keyword: z.string().trim().min(1, "Keyword is required.").max(120),
  url: httpUrl,
  rel: z.enum(["dofollow", "nofollow", "sponsored"]).default("dofollow"),
});

const baseShape = {
  title: z.string().trim().min(1, "Title is required.").max(200),
  slug: z.string().trim().max(120).optional(),
  template: z
    .enum(["how-to", "listicle", "comparison", "review", "news", "generic"])
    .default("generic"),
  body: z.string().default(""),
  excerpt: z.string().trim().max(400).default(""),
  metaTitle: z.string().trim().max(200).default(""),
  coverImage: imageUrl.default(""),
  coverImageAlt: z.string().trim().max(200).default(""),
  keywords: z.array(keywordSchema).max(50).default([]),
  linkOccurrences: z.enum(["first", "all"]).default("first"),
  author: z.string().trim().max(120).default(""),
  status: z.enum(["draft", "published"]).default("draft"),
  publishedAt: publishedAtSchema.optional(),
};

export const createPostSchema = z.object(baseShape);

/** Update: every field optional, no defaults (only provided fields are applied). */
export const updatePostSchema = z
  .object({
    title: z.string().trim().min(1, "Title is required.").max(200),
    slug: z.string().trim().max(120),
    template: z.enum(["how-to", "listicle", "comparison", "review", "news", "generic"]),
    body: z.string(),
    excerpt: z.string().trim().max(400),
    metaTitle: z.string().trim().max(200),
    coverImage: imageUrl,
    coverImageAlt: z.string().trim().max(200),
    keywords: z.array(keywordSchema).max(50),
    linkOccurrences: z.enum(["first", "all"]),
    author: z.string().trim().max(120),
    status: z.enum(["draft", "published"]),
    publishedAt: publishedAtSchema,
  })
  .partial();

export type CreatePostBody = z.infer<typeof createPostSchema>;
export type UpdatePostBody = z.infer<typeof updatePostSchema>;

/** First human-readable validation message from a ZodError. */
export function firstZodError(error: ZodError): string {
  return error.issues[0]?.message ?? "Invalid input.";
}
